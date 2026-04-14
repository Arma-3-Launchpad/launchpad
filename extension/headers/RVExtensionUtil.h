#pragma once
#include <cstdint>
#ifdef _WIN32
#include <windows.h> // GetModuleHandle, GetProcAddress
#else // Linux
#include <dlfcn.h> // dlopen, dlclose, dlsym
#endif

// bitset
enum DllExtensionFeatureFlags : uint64_t
{
	RVFeature_ContextArgumentsVoidPtr = 1 << 0,
	RVFeature_ContextStackTrace = 1 << 1,
	RVFeature_ContextNoDefaultCall = 1 << 2,
};

struct RVContext_StackTrace
{
	struct StackTraceLine
	{
		// Line number in file (before preprocessing if preprocessed with line numbers)
		uint32_t lineNumber;
		// File offset in bytes from the start of the file (after preprocessing)
		uint32_t fileOffset;
		// Filepath to the source file
		const char* sourceFile;
		// scopeName set on that level
		const char* scopeName;
		// Complete fileContent of the sourceFile (after preprocessing, can be combined with fileOffset to find exact location)
		const char* fileContent;
	};

	StackTraceLine* lines = nullptr;
	uint32_t lineCount = 0;
};

#ifdef _WIN32
#define DLLEXPORT __declspec (dllexport)
#define CALL_CONVENTION __stdcall
#else // Linux
#if __GNUC__ >= 4
#define DLLEXPORT __attribute__ ((visibility ("default")))
#else
#define DLLEXPORT __attribute__((dllexport))
#endif

#define CALL_CONVENTION
#endif

extern "C"
{
	typedef int (CALL_CONVENTION RVExtensionCallbackProc)(char const* name, char const* function, char const* data);
	typedef void CALL_CONVENTION RVExtensionRequestContextProc();

	//--- Called by Engine on extension load
	DLLEXPORT void CALL_CONVENTION RVExtensionVersion(char* output, unsigned int outputSize);
	//--- STRING callExtension STRING
	DLLEXPORT void CALL_CONVENTION RVExtension(char* output, unsigned int outputSize, const char* function);
	//--- STRING callExtension ARRAY
	//DLLEXPORT int CALL_CONVENTION RVExtensionArgs(char* output, unsigned int outputSize, const char* function, const char** argv, unsigned int argc);
	//--- Called by Engine on extension load to pass RVExtensionCallbackProc to it
	DLLEXPORT void CALL_CONVENTION RVExtensionRegisterCallback(RVExtensionCallbackProc* callbackProc);
}

//--- Finds a game exported function by its name
inline const void* FindRVFunction(const char* name)
{
#ifdef _WIN32
	return reinterpret_cast<void*>(GetProcAddress(GetModuleHandle(nullptr), name));
#else // Linux
	auto armaHandle = dlopen(nullptr, RTLD_LAZY | RTLD_NOLOAD);
	auto result = dlsym(armaHandle, name);
	dlclose(armaHandle);
	return result;
#endif
}