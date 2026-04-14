#include "ArmaParser.h"
#include <iostream>
#include <string>
#include <vector>
#include <variant>

std::string ArmaParser::unQuote(std::string str)
{
	if (str.size() > 1 && str[0] == '"' && str[str.size() - 1] == '"')
	{
		return str.substr(1, str.size() - 2);
	}
	return str;
}

std::string ArmaParser::singleToDoubleQuotes(std::string str)
{
	for (size_t i = 0; i < str.size(); i++)
	{
		if (str[i] == '\'')
		{
			str[i] = '"';
		}
	}
	return str;
}

// TODO: Implement this
template<typename T>
T ArmaParser::parseValue(const std::variant<int, float, bool, std::string>& value) {
	if (std::holds_alternative<T>(value)) {
		return std::get<T>(value);
	}
	// TODO: Error handling or default return value should be here
	return T{};
}