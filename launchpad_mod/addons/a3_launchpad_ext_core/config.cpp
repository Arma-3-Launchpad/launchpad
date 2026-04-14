class CfgPatches
{
	class a3_launchpad_ext_core
	{
		name="A3 Mission Launchpad API";
		author="Grom";
		url="https://github.com/a3r0id";
		requiredVersion=2.02;
		requiredAddons[]={};
	};
};

class CfgFunctions {
	class a3_launchpad_ext_core {
		class functions {
			file = "a3_launchpad_ext_core\functions";
            class init {postInit = 1;};
            class genId {};
            class call {};
            class asyncCall {};
            class getCallbackStatus {};
            class onIpcInbound {};
		};
	};
};