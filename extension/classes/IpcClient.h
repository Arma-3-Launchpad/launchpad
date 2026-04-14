#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <mutex>
#include <string>
#include <thread>

namespace IpcClient {

constexpr std::size_t kMaxFrameBytes = 16 * 1024 * 1024; // 16 MiB cap per frame

using InboundHandler = std::function<void(const std::string& utf8Json)>;

bool connect(const std::string& host, uint16_t port, InboundHandler onInbound, std::string& errOut);
void disconnect();
bool isConnected();

bool sendJsonFramed(const std::string& utf8Json, std::string& errOut);

} // namespace IpcClient
