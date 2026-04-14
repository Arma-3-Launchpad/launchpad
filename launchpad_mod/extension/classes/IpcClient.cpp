#include "IpcClient.h"
#include "Logging.h"

#include <algorithm>
#include <cstring>
#include <mutex>
#include <vector>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
using socket_t = SOCKET;
static constexpr socket_t kInvalidSocket = INVALID_SOCKET;
static int closeSocket(socket_t s)
{
	return closesocket(s);
}
static int sockErrno()
{
	return WSAGetLastError();
}
static std::once_flag g_wsaOnce;
static bool g_wsaOk = false;
static void initWsaOnce()
{
	WSADATA wsa{};
	g_wsaOk = (WSAStartup(MAKEWORD(2, 2), &wsa) == 0);
}
static bool ensureWinsock()
{
	std::call_once(g_wsaOnce, initWsaOnce);
	return g_wsaOk;
}
#else
#include <arpa/inet.h>
#include <errno.h>
#include <netdb.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
using socket_t = int;
static constexpr socket_t kInvalidSocket = -1;
static int closeSocket(socket_t s)
{
	return ::close(s);
}
static int sockErrno()
{
	return errno;
}
static bool ensureWinsock()
{
	return true;
}
#endif

namespace {

std::mutex g_stateMutex;
socket_t g_sock = kInvalidSocket;
std::thread g_reader;
std::atomic<bool> g_readerStop{false};
IpcClient::InboundHandler g_handler;

bool recvExact(socket_t s, void* buf, size_t len)
{
	auto* p = static_cast<unsigned char*>(buf);
	size_t off = 0;
	while (off < len) {
#ifdef _WIN32
		const int chunk = static_cast<int>(std::min<size_t>(len - off, static_cast<size_t>(INT_MAX)));
		int r = ::recv(s, reinterpret_cast<char*>(p + off), chunk, 0);
#else
		ssize_t r = ::recv(s, p + off, len - off, 0);
#endif
		if (r <= 0)
			return false;
		off += static_cast<size_t>(r);
	}
	return true;
}

bool sendAll(socket_t s, const void* buf, size_t len)
{
	const auto* p = static_cast<const unsigned char*>(buf);
	size_t off = 0;
	while (off < len) {
#ifdef _WIN32
		const int chunk = static_cast<int>(std::min<size_t>(len - off, static_cast<size_t>(INT_MAX)));
		int w = ::send(s, reinterpret_cast<const char*>(p + off), chunk, 0);
#else
		ssize_t w = ::send(s, p + off, len - off, 0);
#endif
		if (w <= 0)
			return false;
		off += static_cast<size_t>(w);
	}
	return true;
}

void readerLoop()
{
	for (;;) {
		if (g_readerStop.load(std::memory_order_acquire))
			break;

		socket_t s = kInvalidSocket;
		{
			std::lock_guard<std::mutex> lock(g_stateMutex);
			s = g_sock;
		}
		if (s == kInvalidSocket)
			break;

		uint32_t lenBE = 0;
		if (!recvExact(s, &lenBE, sizeof(lenBE)))
			break;
		const uint32_t n = ntohl(lenBE);
		if (n == 0 || n > IpcClient::kMaxFrameBytes) {
			Logging::logError(("IpcClient: invalid frame length " + std::to_string(n)).c_str());
			break;
		}

		std::string body;
		body.resize(n);
		if (!recvExact(s, body.data(), n))
			break;

		IpcClient::InboundHandler h;
		{
			std::lock_guard<std::mutex> lock(g_stateMutex);
			h = g_handler;
		}
		if (h)
			h(body);
	}

	std::lock_guard<std::mutex> lock(g_stateMutex);
	if (g_sock != kInvalidSocket) {
#ifdef _WIN32
		::shutdown(g_sock, SD_BOTH);
#else
		::shutdown(g_sock, SHUT_RDWR);
#endif
		closeSocket(g_sock);
		g_sock = kInvalidSocket;
	}
}

} // namespace

namespace IpcClient {

bool connect(const std::string& host, uint16_t port, InboundHandler onInbound, std::string& errOut)
{
	if (!ensureWinsock()) {
		errOut = "WSAStartup failed";
		return false;
	}

	disconnect();

	std::lock_guard<std::mutex> lock(g_stateMutex);
	g_handler = std::move(onInbound);

	addrinfo hints{};
	hints.ai_family = AF_UNSPEC;
	hints.ai_socktype = SOCK_STREAM;
	hints.ai_protocol = IPPROTO_TCP;

	addrinfo* res = nullptr;
	const std::string portStr = std::to_string(static_cast<int>(port));
	const int gai = getaddrinfo(host.c_str(), portStr.c_str(), &hints, &res);
	if (gai != 0 || !res) {
#ifdef _WIN32
		errOut = std::string("getaddrinfo failed: ") + std::to_string(gai);
#else
		errOut = std::string("getaddrinfo failed: ") + gai_strerror(gai);
#endif
		return false;
	}

	socket_t s = kInvalidSocket;
	for (addrinfo* p = res; p != nullptr; p = p->ai_next) {
		s = static_cast<socket_t>(::socket(p->ai_family, p->ai_socktype, p->ai_protocol));
		if (s == kInvalidSocket)
			continue;
		if (::connect(s, p->ai_addr, static_cast<int>(p->ai_addrlen)) == 0)
			break;
		closeSocket(s);
		s = kInvalidSocket;
	}
	freeaddrinfo(res);

	if (s == kInvalidSocket) {
		errOut = "connect failed (errno=" + std::to_string(sockErrno()) + ")";
		g_handler = nullptr;
		return false;
	}

	g_sock = s;
	g_readerStop.store(false, std::memory_order_release);
	g_reader = std::thread(readerLoop);
	return true;
}

void disconnect()
{
	{
		std::lock_guard<std::mutex> lock(g_stateMutex);
		g_readerStop.store(true, std::memory_order_release);
		if (g_sock != kInvalidSocket) {
#ifdef _WIN32
			::shutdown(g_sock, SD_BOTH);
#else
			::shutdown(g_sock, SHUT_RDWR);
#endif
		}
	}

	if (g_reader.joinable())
		g_reader.join();
	g_readerStop.store(false, std::memory_order_release);

	std::lock_guard<std::mutex> lock(g_stateMutex);
	if (g_sock != kInvalidSocket) {
		closeSocket(g_sock);
		g_sock = kInvalidSocket;
	}
	g_handler = nullptr;
}

bool isConnected()
{
	std::lock_guard<std::mutex> lock(g_stateMutex);
	return g_sock != kInvalidSocket;
}

bool sendJsonFramed(const std::string& utf8Json, std::string& errOut)
{
	if (utf8Json.size() > kMaxFrameBytes) {
		errOut = "payload too large";
		return false;
	}

	std::lock_guard<std::mutex> lock(g_stateMutex);
	if (g_sock == kInvalidSocket) {
		errOut = "not connected";
		return false;
	}

	const uint32_t len = htonl(static_cast<uint32_t>(utf8Json.size()));
	if (!sendAll(g_sock, &len, sizeof(len))) {
		errOut = "send length failed (errno=" + std::to_string(sockErrno()) + ")";
		return false;
	}
	if (!utf8Json.empty() && !sendAll(g_sock, utf8Json.data(), utf8Json.size())) {
		errOut = "send body failed (errno=" + std::to_string(sockErrno()) + ")";
		return false;
	}
	return true;
}

} // namespace IpcClient
