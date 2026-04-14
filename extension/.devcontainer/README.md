# Linux Build Environment for MAD Extension

This directory contains the Docker configuration for building Linux binaries of the MAD Extension in an Ubuntu 22.04 container.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- VS Code with the "Dev Containers" extension installed

## Usage

### Option 1: VS Code Dev Containers (Recommended)

1. Open VS Code in the `extension` folder
2. Press `F1` or `Ctrl+Shift+P` to open the command palette
3. Type "Dev Containers: Reopen in Container"
4. VS Code will build the Docker image and open the workspace inside the container
5. Once inside the container, use the CMake extension to:
   - Select the `linux-debug` or `linux-release` preset
   - Configure and build your project

### Option 2: Manual Docker Build

If you prefer to use Docker directly without VS Code:

```bash
# Build the Docker image
docker build -t mad-ext-linux-build -f .devcontainer/Dockerfile .

# Run the container interactively
docker run -it -v "${PWD}/..:/workspace" -w /workspace/extension mad-ext-linux-build

# Inside the container, configure and build:
cmake --preset linux-release
cmake --build out/build/linux-release
```

### Option 3: Docker Compose

```bash
# Build and start the container
docker-compose -f .devcontainer/docker-compose.yml up -d

# Execute commands in the container
docker-compose -f .devcontainer/docker-compose.yml exec mad-ext-build bash

# Build inside the container
cmake --preset linux-release
cmake --build out/build/linux-release
```

## Building

Once inside the container:

1. **Configure the build:**
   ```bash
   cmake --preset linux-release
   # or
   cmake --preset linux-debug
   ```

2. **Build the project:**
   ```bash
   cmake --build out/build/linux-release
   ```

3. **The output will be in:**
   - `out/build/linux-release/` (build artifacts)
   - `out/install/linux-release/` (installed files)

## Output Files

The Linux build will produce:
- `A3_LAUNCHPAD_EXT_x64.so` - The main extension library

## Notes

- The container includes all necessary build tools (gcc, g++, cmake, ninja, etc.)
- Dependencies (libcpr, nlohmann/json) are fetched automatically via CMake's FetchContent
- The workspace is mounted as a volume, so changes on your host are immediately visible in the container
