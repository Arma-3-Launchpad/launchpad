/**
	Cross-platform tool to hook into the Arma 3 runtime process (battleeye disabled!!! - This is strictly for development purposes only!)

	Usage: ./a3hook -h or ./a3hook --help
	Flags Examples:
		- General:
			-h, --help: Show help message and exit

		- Memory Dump:
			memdump: Write a minidump (.dmp) of the process (Windows: dbghelp). Set A3HOOK_FULL_MINIDUMP=1 for MiniDumpWithFullMemory (very large).
			Example: ./a3hook {arma 3 process id} memdump {output file path}

		- Hijack Window:
			hijack: Reparent the target's largest visible top-level window into the owner process's main window (SetParent). Windows only.
			Example: ./a3hook {arma 3 process id} hijack {our process id}
*/

#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <mutex>
#include <string>

#include <nlohmann/json.hpp>

using json = nlohmann::json;

static void logError(const std::string& msg) { std::cerr << msg << '\n'; }
static void logInfo(const std::string& msg) { std::cout << msg << '\n'; }

static std::mutex g_Mutex;

[[maybe_unused]] static bool writeJsonToFile(const std::string& filePath, const json& j) {
	std::lock_guard<std::mutex> lock(g_Mutex);
	try {
		std::filesystem::path p(filePath);
		if (!p.parent_path().empty() && !std::filesystem::exists(p.parent_path()))
			std::filesystem::create_directories(p.parent_path());
	} catch (const std::filesystem::filesystem_error& e) {
		logError("Failed to create directory for: " + filePath + " - " + e.what());
		return false;
	}
	std::ofstream f(filePath);
	if (!f.is_open()) {
		logError("Failed to open file for writing: " + filePath);
		return false;
	}
	f << j.dump(2);
	return true;
}

static void printHelp() {
	std::cout
	    << "a3hook (development only)\n"
	    << "  -h, --help              Show this help\n"
	    << "  <pid> memdump <file>    Write a minidump (.dmp). Windows: dbghelp. Optional env A3HOOK_FULL_MINIDUMP=1 for full memory (huge).\n"
	    << "  <pid> hijack <ownPid>   Reparent target's main window into owner's main window (Windows).\n";
}

static bool parsePid(const char* s, unsigned long& outPid) {
	if (!s || !*s) {
		return false;
	}
	char* end = nullptr;
	unsigned long v = std::strtoul(s, &end, 10);
	if (end == s || *end != '\0' || v == 0) {
		return false;
	}
	outPid = v;
	return true;
}

#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>
#include <DbgHelp.h>

#pragma comment(lib, "Dbghelp.lib")

static std::string winLastErrorString(const char* context) {
	const DWORD err = GetLastError();
	char buf[512];
	if (FormatMessageA(FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS, nullptr, err, 0, buf,
	        static_cast<DWORD>(sizeof(buf)), nullptr)) {
		return std::string(context) + " (Windows error " + std::to_string(err) + "): " + buf;
	}
	return std::string(context) + " (Windows error " + std::to_string(err) + ")";
}

struct MainWindowSearch {
	DWORD pid = 0;
	HWND best = nullptr;
	LONG bestArea = -1;
};

static BOOL CALLBACK enumTopLevelWindows(HWND hwnd, LPARAM lp) {
	auto* s = reinterpret_cast<MainWindowSearch*>(lp);
	DWORD wpid = 0;
	GetWindowThreadProcessId(hwnd, &wpid);
	if (wpid != s->pid) {
		return TRUE;
	}
	if (!IsWindowVisible(hwnd)) {
		return TRUE;
	}
	if (GetWindow(hwnd, GW_OWNER) != nullptr) {
		return TRUE;
	}
	const LONG_PTR ex = GetWindowLongPtr(hwnd, GWL_EXSTYLE);
	if (ex & WS_EX_TOOLWINDOW) {
		return TRUE;
	}
	RECT r{};
	if (!GetWindowRect(hwnd, &r)) {
		return TRUE;
	}
	const LONG w = r.right - r.left;
	const LONG h = r.bottom - r.top;
	if (w < 160 || h < 120) {
		return TRUE;
	}
	const LONG area = w * h;
	if (area > s->bestArea) {
		s->bestArea = area;
		s->best = hwnd;
	}
	return TRUE;
}

static HWND findMainVisibleWindow(DWORD pid) {
	MainWindowSearch s;
	s.pid = pid;
	EnumWindows(enumTopLevelWindows, reinterpret_cast<LPARAM>(&s));
	return s.best;
}

static MINIDUMP_TYPE minidumpTypeFromEnv() {
	MINIDUMP_TYPE t = static_cast<MINIDUMP_TYPE>(
	    MiniDumpWithPrivateReadWriteMemory | MiniDumpWithDataSegs | MiniDumpWithHandleData | MiniDumpWithThreadInfo
	    | MiniDumpWithUnloadedModules | MiniDumpWithFullMemoryInfo | MiniDumpWithProcessThreadData);
	const char* full = std::getenv("A3HOOK_FULL_MINIDUMP");
	if (full && full[0] == '1' && full[1] == '\0') {
		t = static_cast<MINIDUMP_TYPE>(t | MiniDumpWithFullMemory);
		logInfo("A3HOOK_FULL_MINIDUMP=1: including MiniDumpWithFullMemory (file may be very large).");
	}
	return t;
}

static bool writeMemoryMinidump(unsigned long pid, const std::filesystem::path& outPath) {
	const DWORD access = PROCESS_QUERY_INFORMATION | PROCESS_VM_READ;
	HANDLE hProcess = OpenProcess(access, FALSE, static_cast<DWORD>(pid));
	if (!hProcess) {
		logError("OpenProcess failed: " + winLastErrorString("memdump"));
		logInfo("Tip: run from an elevated shell if the target is protected, or use the same user session.");
		return false;
	}

	std::error_code ec;
	std::filesystem::create_directories(outPath.parent_path(), ec);

	const std::wstring wnative = outPath.wstring();
	HANDLE hFile = CreateFileW(wnative.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
	if (hFile == INVALID_HANDLE_VALUE) {
		logError("CreateFileW failed: " + winLastErrorString(outPath.string().c_str()));
		CloseHandle(hProcess);
		return false;
	}

	const MINIDUMP_TYPE dumpType = minidumpTypeFromEnv();
	const BOOL ok = MiniDumpWriteDump(hProcess, static_cast<DWORD>(pid), hFile, dumpType, nullptr, nullptr, nullptr);
	if (!ok) {
		logError("MiniDumpWriteDump failed: " + winLastErrorString("memdump"));
		CloseHandle(hFile);
		CloseHandle(hProcess);
		return false;
	}
	CloseHandle(hFile);
	CloseHandle(hProcess);
	logInfo("Wrote minidump: " + outPath.string());
	return true;
}

static bool hijackWindow(unsigned long targetPid, unsigned long ownerPid) {
	if (targetPid == ownerPid) {
		logError("hijack: target and owner PIDs must differ.");
		return false;
	}

	HWND targetHw = findMainVisibleWindow(static_cast<DWORD>(targetPid));
	HWND parentHw = findMainVisibleWindow(static_cast<DWORD>(ownerPid));
	if (!targetHw) {
		logError("Could not find a suitable top-level window for target PID " + std::to_string(targetPid) + ".");
		return false;
	}
	if (!parentHw) {
		logError("Could not find a suitable top-level window for owner PID " + std::to_string(ownerPid) + ".");
		return false;
	}

	// Reparent: make target a child of owner's main window; adjust style so layout is consistent.
	SetLastError(0);
	const LONG_PTR styleRaw = GetWindowLongPtr(targetHw, GWL_STYLE);
	if (styleRaw == 0 && GetLastError() != 0) {
		logError("GetWindowLongPtr(GWL_STYLE) failed: " + winLastErrorString("hijack"));
		return false;
	}
	LONG_PTR style = styleRaw;
	style &= ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU);
	style |= WS_CHILD | WS_VISIBLE;
	if (!SetWindowLongPtr(targetHw, GWL_STYLE, style)) {
		logError("SetWindowLongPtr failed: " + winLastErrorString("hijack"));
		return false;
	}

	if (!SetParent(targetHw, parentHw)) {
		logError("SetParent failed: " + winLastErrorString("hijack"));
		return false;
	}

	RECT client{};
	GetClientRect(parentHw, &client);
	const int width = client.right - client.left;
	const int height = client.bottom - client.top;
	SetWindowPos(targetHw, nullptr, 0, 0, width, height, SWP_NOZORDER | SWP_FRAMECHANGED);
	ShowWindow(targetHw, SW_SHOW);

	logInfo("Reparented target window into owner. Resize the owner window manually if needed.");
	return true;
}

#else

static bool writeMemoryMinidump(unsigned long pid, const std::filesystem::path& outPath) {
	(void)pid;
	(void)outPath;
	logError("memdump is only implemented on Windows (minidump via dbghelp).");
	return false;
}

static bool hijackWindow(unsigned long targetPid, unsigned long ownerPid) {
	(void)targetPid;
	(void)ownerPid;
	logError("hijack is only implemented on Windows.");
	return false;
}

#endif

int main(int argc, char** argv) {
	if (argc <= 1) {
		printHelp();
		return 1;
	}
	const std::string a1(argv[1]);
	if (a1 == "-h" || a1 == "--help") {
		printHelp();
		return 0;
	}

	if (argc < 4) {
		logError("Not enough arguments. Use -h or --help.");
		return 2;
	}

	unsigned long targetPid = 0;
	if (!parsePid(argv[1], targetPid)) {
		logError("Invalid process id: " + std::string(argv[1]));
		return 2;
	}

	const std::string cmd(argv[2]);
	if (cmd == "memdump") {
		const std::filesystem::path outPath(argv[3]);
		return writeMemoryMinidump(targetPid, outPath) ? 0 : 3;
	}
	if (cmd == "hijack") {
		unsigned long ownerPid = 0;
		if (!parsePid(argv[3], ownerPid)) {
			logError("Invalid owner process id: " + std::string(argv[3]));
			return 2;
		}
		return hijackWindow(targetPid, ownerPid) ? 0 : 3;
	}

	logError("Unknown subcommand: " + cmd);
	return 3;
}
