import ctypes
import os
import time
import sys
import json

def python_callback(name, function, data):
    try:
        name_str = ctypes.cast(name, ctypes.c_char_p).value.decode('utf-8')
        function_str = ctypes.cast(function, ctypes.c_char_p).value.decode('utf-8')
        data_str = ctypes.cast(data, ctypes.c_char_p).value.decode('utf-8')
        
        print(f"\n{'='*60}")
        print(f"Callback: {name_str} -> {function_str}")
        print(f"{'='*60}")
        
        # Try to pretty print if it's JSON
        try:
            json_data = json.loads(data_str)
            print("JSON Response (formatted):")
            print(json.dumps(json_data, indent=2))
        except (json.JSONDecodeError, ValueError):
            # Not JSON, just print as-is
            print("Response:")
            print(data_str)
        
        print(f"{'='*60}\n")
        
    except UnicodeDecodeError as e:
        print(f"Decode error: {e}")
        return 0
    return 1

def invoke(binary_runtime_path=None, function_name="healthCheck", data=None):
    """
    Invoke a function in the A3_LAUNCHPAD_EXT DLL.
    
    Args:
        binary_runtime_path: Path to the DLL. If None, reads from sys.argv[1]
        function_name: Name of the function to call. Defaults to "healthCheck"
        data: Optional JSON data string to pass to the function (will be combined with function_name using | delimiter)
    
    Returns:
        True if successful, False otherwise
    """
    CallbackType = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p)
    callback_func = CallbackType(python_callback)

    # Get binary path from parameter or command line
    if binary_runtime_path is None:
        if len(sys.argv) < 2:
            print("Usage: python invoker.py <binary_runtime_path> [function_name] [data_json]")
            return False
        binary_runtime_path = sys.argv[1]
        if len(sys.argv) >= 3:
            function_name = sys.argv[2]
        if len(sys.argv) >= 4:
            data = sys.argv[3]
    
    if not os.path.exists(binary_runtime_path):
        print(f"Error: Binary runtime path {binary_runtime_path} does not exist")
        return False

    print(f"[+INVOKE+] Loading DLL from {binary_runtime_path}")
    try:
        dll = ctypes.CDLL(binary_runtime_path)  # Load the DLL
    except OSError as e:
        print(f"Error loading DLL: {e}")
        return False

    # Register the callback
    print("[+INVOKE+] Registering callback")
    dll.RVExtensionRegisterCallback.argtypes = [CallbackType]
    dll.RVExtensionRegisterCallback(callback_func)

    # Build function argument: "functionName" or "functionName|data"
    if data is not None and data.strip():
        function_argument_str = f"{function_name}|{data}"
    else:
        function_argument_str = function_name
    
    function_argument = function_argument_str.encode('utf-8')

    # Set up RVExtension function argument types (3 parameters: output, outputSize, function)
    dll.RVExtension.argtypes = [ctypes.c_char_p, ctypes.c_uint, ctypes.c_char_p]

    # Preallocate buffer
    buffer_size = 1024
    output = ctypes.create_string_buffer(buffer_size)

    # Call the function
    print(f"[+INVOKE+] Calling RVExtension with argument: {function_argument_str}")
    dll.RVExtension(output, ctypes.c_uint(buffer_size), ctypes.c_char_p(function_argument))
    
    return True

if __name__ == "__main__":
    result = invoke(r"D:\Storage\2026 Projects\mad-framework\extension\out\build\x64-debug\A3_LAUNCHPAD_EXT_x64.dll")
    if result:
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            exit(0)
    else:
        exit(1)


# bump ci 1