// Append-only file logging for the Arma 3 extension. Each line is timestamped and written to
// a3_launchpad_ext.log beside the loaded DLL/SO (not the game working directory), so logs stay
// with the extension install regardless of how Arma is launched.
#include "Logging.h"
#include <fstream>
#include <chrono>
#include <ctime>
#include <sstream>
#include <filesystem>
#include <string>

#ifdef _WIN32
#include <windows.h>
#else
#include <dlfcn.h>
#endif

namespace
{
	// Resolves the directory containing this shared library. Arma's CWD is often unrelated to
	// the mod folder, so we use the module path (Windows) or dladdr (POSIX) and fall back to
	// current_path() if resolution fails.
	std::filesystem::path getExtensionDirectory()
	{
#ifdef _WIN32
		HMODULE hModule = nullptr;
		if (GetModuleHandleExA(
			GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
			reinterpret_cast<LPCSTR>(&getExtensionDirectory),
			&hModule))
		{
			char buffer[MAX_PATH];
			DWORD len = GetModuleFileNameA(hModule, buffer, MAX_PATH);
			if (len > 0)
			{
				std::filesystem::path p(buffer);
				return p.parent_path();
			}
		}
		return std::filesystem::current_path();
#else
		Dl_info info{};
		if (dladdr(reinterpret_cast<void*>(&getExtensionDirectory), &info) && info.dli_fname)
		{
			std::filesystem::path p(info.dli_fname);
			return p.parent_path();
		}
		return std::filesystem::current_path();
#endif
	}
}

void Logging::baseLog(const char* message)
{
	static const std::filesystem::path logFilePath = getExtensionDirectory() / "a3_launchpad_ext.log";

	// Ensure parent directory exists (first run or unusual layouts); skip logging if creation fails.
	std::filesystem::path dirPath = logFilePath.parent_path();
	if (!dirPath.empty() && !std::filesystem::exists(dirPath))
	{
		try
		{
			std::filesystem::create_directories(dirPath);
		}
		catch (const std::filesystem::filesystem_error&)
		{
			return;
		}
	}

	auto now = std::chrono::system_clock::now();
	std::time_t now_time = std::chrono::system_clock::to_time_t(now);

	std::tm* ptm = std::localtime(&now_time);

	char buffer[32];
	std::strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", ptm);

	// Open in append mode so concurrent writers and restarts preserve history.
	std::ofstream logFile(logFilePath, std::ios_base::app);
	if (logFile.is_open())
	{
		logFile << "[" << buffer << "] " << message << std::endl;
		logFile.close();
	}
}

// logDebug / logError share the same sink today; split here if levels or filtering are added later.
void Logging::logDebug(const char* message)
{
	baseLog(message);
}

void Logging::logError(const char* message)
{
	baseLog(message);
}
