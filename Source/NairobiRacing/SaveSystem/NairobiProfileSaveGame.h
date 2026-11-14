#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Core/NairobiTypes.h"
#include "NairobiProfileSaveGame.generated.h"

/**
 * Native player profile (replaces the prototype's browser localStorage).
 *
 * Local save data only: settings, selected vehicle, local best laps, ghost lap and
 * progression counters. Official competitive records live on the backend and are
 * validated server-side; they are never written from this object.
 */
UCLASS()
class NAIROBIRACING_API UNairobiProfileSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	FNairobiGraphicsSettings GraphicsSettings;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	FNairobiAudioSettings AudioSettings;

	UPROPERTY(BlueprintReadWrite, Category = "Settings")
	FNairobiControlSettings ControlSettings;

	UPROPERTY(BlueprintReadWrite, Category = "Profile")
	FString SelectedVehicleId = TEXT("safari-rally-gt");

	UPROPERTY(BlueprintReadWrite, Category = "Profile")
	int32 RacesCompleted = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Profile")
	float BestLapSeconds = 0.f;

	UPROPERTY(BlueprintReadWrite, Category = "Profile")
	int32 ExperiencePoints = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Profile")
	TArray<FNairobiLapRecord> LocalBestLaps;

	UPROPERTY(BlueprintReadWrite, Category = "Ghost")
	TArray<FNairobiGhostSample> BestGhostSamples;

	UPROPERTY(BlueprintReadWrite, Category = "Ghost")
	float BestGhostLapSeconds = 0.f;

	UPROPERTY(BlueprintReadWrite, Category = "Meta")
	int32 SaveVersion = 1;
};
