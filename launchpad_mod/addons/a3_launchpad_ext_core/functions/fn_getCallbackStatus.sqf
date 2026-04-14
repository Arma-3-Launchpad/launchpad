/**
 * Function: A3_LAUNCHPAD_EXT_fnc_getCallbackStatus
 * Description: Checks the status of an async extension call by its ID.
 * Parameters:
 *     _callId: String - The unique call ID returned from A3_LAUNCHPAD_EXT_fnc_asyncCall.
 * Returns:
 *     Array - [completed: Boolean, result: Any, hasCallback: Boolean]
 *             - completed: Whether the callback has been received
 *             - result: The result data (nil if not completed)
 *             - hasCallback: Whether the call ID exists in the callbacks map
 */
params ["_callId"];

if (isNil "A3_LAUNCHPAD_EXT_CALLBACKS") then { A3_LAUNCHPAD_EXT_CALLBACKS = createHashMap; };
if (!(_callId in A3_LAUNCHPAD_EXT_CALLBACKS)) then {
    [false, nil, false]
} else {
    private _callbackData = A3_LAUNCHPAD_EXT_CALLBACKS get _callId;
    private _completed = _callbackData select 2;
    private _result = _callbackData select 1;
    [_completed, _result, true]
}
