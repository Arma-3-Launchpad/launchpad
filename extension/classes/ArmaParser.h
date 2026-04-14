#pragma once
#include <iostream>
#include <map>
#include <vector>
#include <variant>

class ArmaParser {
public:
	static std::string unQuote(std::string str);
    static std::string singleToDoubleQuotes(std::string str);
    template<typename T>
    static T parseValue(const std::variant<int, float, bool, std::string>& value);
};