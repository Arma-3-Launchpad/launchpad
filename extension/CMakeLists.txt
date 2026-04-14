cmake_minimum_required(VERSION 3.21)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

project(A3_LAUNCHPAD_EXT)

# Add source to this project's library.
add_library(
  A3_LAUNCHPAD_EXT MODULE
  "a3-launchpad-ext.cpp"
  "headers/RVExtensionUtil.h"
  "headers/types.h"
  "classes/ArmaParser.h"
  "classes/ArmaParser.cpp"
  "classes/Logging.cpp"
  "classes/Logging.h"
  "classes/IpcClient.cpp"
  "classes/IpcClient.h"
)

if(NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
	message(FATAL_ERROR "Only 64-bit builds are supported")
endif()

# Enable Hot Reload for MSVC compilers if supported.
if (POLICY CMP0141)
  cmake_policy(SET CMP0141 NEW)
  set(CMAKE_MSVC_DEBUG_INFORMATION_FORMAT "$<IF:$<AND:$<C_COMPILER_ID:MSVC>,$<CXX_COMPILER_ID:MSVC>>,$<$<CONFIG:Debug,RelWithDebInfo>:EditAndContinue>,$<$<CONFIG:Debug,RelWithDebInfo>:ProgramDatabase>>")
endif()

if (CMAKE_VERSION VERSION_GREATER 3.12)
  set_property(TARGET A3_LAUNCHPAD_EXT PROPERTY CXX_STANDARD 20)
endif()

set_target_properties(A3_LAUNCHPAD_EXT PROPERTIES OUTPUT_NAME "A3_LAUNCHPAD_EXT_x64")
set_target_properties(A3_LAUNCHPAD_EXT PROPERTIES CXX_STANDARD 17)

# Dependencies via FetchContent
include(FetchContent)

# Nlohmann JSON
find_package(nlohmann_json 3.11.3 QUIET)
if (NOT nlohmann_json_FOUND)
    FetchContent_Declare(json URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz)
    FetchContent_MakeAvailable(json)
endif()
target_link_libraries(A3_LAUNCHPAD_EXT PRIVATE nlohmann_json::nlohmann_json)

if (WIN32)
  target_link_libraries(A3_LAUNCHPAD_EXT PRIVATE ws2_32)
endif()

# Ship extension + runtime deps next to the mod layout (repository root ../bin/mod)
set(_LAUNCHPAD_MOD_BIN "${CMAKE_SOURCE_DIR}/../bin/mod")
add_custom_command(TARGET A3_LAUNCHPAD_EXT POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "${_LAUNCHPAD_MOD_BIN}"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        $<TARGET_FILE:A3_LAUNCHPAD_EXT>
        "${_LAUNCHPAD_MOD_BIN}/"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        $<TARGET_RUNTIME_DLLS:A3_LAUNCHPAD_EXT>
        "${_LAUNCHPAD_MOD_BIN}/"
    COMMAND_EXPAND_LISTS
    COMMENT "Copying A3_LAUNCHPAD_EXT and runtime libraries to bin/mod"
)

if (UNIX)
    set_target_properties(A3_LAUNCHPAD_EXT PROPERTIES PREFIX "")
    if(DEFINED A3_LAUNCHPAD_EXT_INSTALL_DIR)
        set_target_properties(A3_LAUNCHPAD_EXT PROPERTIES LIBRARY_OUTPUT_DIRECTORY "${A3_LAUNCHPAD_EXT_INSTALL_DIR}")
        install(TARGETS A3_LAUNCHPAD_EXT DESTINATION "${A3_LAUNCHPAD_EXT_INSTALL_DIR}")
    else()
        set_target_properties(A3_LAUNCHPAD_EXT PROPERTIES LIBRARY_OUTPUT_DIRECTORY "/home/steam/arma3/A3_LAUNCHPAD_EXT")
        install(TARGETS A3_LAUNCHPAD_EXT DESTINATION "/home/steam/arma3/A3_LAUNCHPAD_EXT")
    endif()
endif()
