#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "Core/NairobiTypes.h"
#include "NairobiRacePlayerState.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FNairobiCheckpointCleared, int32, CheckpointIndex, int32, Lap);

/**
 * A racer's authoritative competitive state.
 *
 * Every field here is written by ANairobiRaceManager on the server and replicated to
 * its owning client. Client-side HUD code reads these values, it never writes them.
 */
UCLASS()
class NAIROBIRACING_API ANairobiRacePlayerState : public APlayerState
{
	GENERATED_BODY()

public:
	ANairobiRacePlayerState();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	UFUNCTION(BlueprintPure, Category = "Race")
	int32 GetNextCheckpointIndex() const { return NextCheckpointIndex; }

	UFUNCTION(BlueprintPure, Category = "Race")
	int32 GetLap() const { return Lap; }

	UFUNCTION(BlueprintPure, Category = "Race")
	int32 GetLapsCompleted() const { return LapsCompleted; }

	UFUNCTION(BlueprintPure, Category = "Race")
	float GetBestLapSeconds() const { return BestLapSeconds; }

	UFUNCTION(BlueprintPure, Category = "Race")
	bool HasFinished() const { return bFinished; }

	UFUNCTION(BlueprintPure, Category = "Race")
	float GetFinishTimeSeconds() const { return FinishTimeSeconds; }

	UFUNCTION(BlueprintPure, Category = "Race")
	int32 GetRacePosition() const { return RacePosition; }

	UFUNCTION(BlueprintPure, Category = "Race")
	const FString& GetVehicleId() const { return VehicleId; }

	UFUNCTION(BlueprintPure, Category = "Race")
	bool IsReady() const { return bReady; }

	/** Server-only setters. All are no-ops without authority. */
	void SetRaceProgress(int32 InNextCheckpointIndex, int32 InLap, int32 InLapsCompleted, float InBestLap);
	void SetFinished(float InFinishTimeSeconds);
	void SetRacePosition(int32 InPosition);
	void SetVehicleId(const FString& InVehicleId);
	void SetReady(bool bInReady);
	void SetLastRejectedCheckpoint(int32 CheckpointId);

	UPROPERTY(BlueprintAssignable, Category = "Race")
	FNairobiCheckpointCleared OnCheckpointCleared;

	/** Best validated lap ghost, server-recorded. Not replicated per frame. */
	UPROPERTY(BlueprintReadOnly, Category = "Ghost")
	TArray<FNairobiGhostSample> BestLapGhost;

	UPROPERTY(BlueprintReadOnly, Category = "Ghost")
	float BestLapGhostTime = 0.f;

protected:
	UFUNCTION()
	void OnRep_Progress();

	UPROPERTY(ReplicatedUsing = OnRep_Progress, BlueprintReadOnly, Category = "Race")
	int32 NextCheckpointIndex = 0;

	UPROPERTY(ReplicatedUsing = OnRep_Progress, BlueprintReadOnly, Category = "Race")
	int32 Lap = 1;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	int32 LapsCompleted = 0;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	float BestLapSeconds = 0.f;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	bool bFinished = false;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	float FinishTimeSeconds = 0.f;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	int32 RacePosition = 0;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	FString VehicleId;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	bool bReady = false;

	/** Diagnostics only: lets a rejected client explain itself in logs/telemetry. */
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race|Diagnostics")
	int32 LastRejectedCheckpointId = INDEX_NONE;
};
