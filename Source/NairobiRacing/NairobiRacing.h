#pragma once

#include "CoreMinimal.h"
#include "Logging/LogMacros.h"

/** Project-wide log categories. Keep category names stable: tooling greps for them. */
DECLARE_LOG_CATEGORY_EXTERN(LogNairobiRace, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogNairobiVehicle, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogNairobiAI, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogNairobiTraffic, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogNairobiWeather, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogNairobiOnline, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogNairobiSave, Log, All);
