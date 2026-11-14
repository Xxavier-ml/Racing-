#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/NairobiTypes.h"
#include "NairobiSaveSubsystem.generated.h"

class UNairobiProfileSaveGame;

/**
 * Local persistence for settings, progress and best-lap ghosts.
 *
 * Uses the engine SaveGame slot system so data survives packaging and platform
 * differences. Competitive records are intentionally excluded here: those must be
 * server-validated before they become official (see NETWORKING.md).
 */
UCLASS()
class NAIROBIRACING_API UNairobiSaveSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FGameInstance* GameInstance) override;

	UFUNCTION(BlueprintCallable, Category = "Save")
	void LoadOrCreateProfile();

	UFUNCTION(BlueprintCallable, Category = "Save")
	bool SaveProfile();

	UFUNCTION(BlueprintPure, Category = "Save")
	UNairobiProfileSaveGame* GetProfile() const { return Profile; }

	/** Saves settings and applies nothing implicitly; callers own application. */
	UFUNCTION(BlueprintCallable, Category = "Save")
	bool SaveSettings(const FNairobiGraphicsSettings& Graphics, const FNairobiAudioSettings& Audio, const FNairobiControlSettings& Controls);

	UFUNCTION(BlueprintCallable, Category = "Save")
	bool SetSelectedVehicle(const FString& VehicleId);

	/**
	 * Records a locally driven lap. The ghost is sanitised by the shared rules layer so
	 * corrupt recordings cannot crash replay.
	 */
	bool RecordLocalLap(const FNairobiLapRecord& Record, const TArray<FNairobiGhostSample>& GhostSamples);

	UFUNCTION(BlueprintCallable, Category = "Save")
	void ResetProfile();

	static const FString SlotName;

protected:
	UPROPERTY()
	TObjectPtr<UNairobiProfileSaveGame> Profile;
};
