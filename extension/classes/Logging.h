#pragma once
// static class for logging
class Logging
{
public:
	// Writes a single log line to A3_LAUNCHPAD_EXT.log in the same directory as the extension binary
	static void baseLog(const char* message);
	static void logDebug(const char* message);
	static void logError(const char* message);
};