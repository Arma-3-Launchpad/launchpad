class Util {
public:
    static std::string getExtensionDirectory() {
        return std::filesystem::path(__FILE__).parent_path().string();
    }
};