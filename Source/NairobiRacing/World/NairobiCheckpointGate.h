#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NairobiCheckpointGate.generated.h"

class UBoxComponent;
class UStaticMeshComponent;

/**
 * A checkpoint gate in the world.
 *
 * The gate only advertises an id and a volume. Whether a crossing counts is decided by
 * ANairobiRaceManager on the server, using the server's copy of the vehicle transform.
 */
UCLASS()
class NAIROBIRACING_API ANairobiCheckpointGate : public AActor
{
	GENERATED_BODY()

public:
	ANairobiCheckpointGate();

	UFUNCTION(BlueprintPure, Category = "Checkpoint")
	int32 GetCheckpointId() const { return CheckpointId; }

	UFUNCTION(BlueprintCallable, Category = "Checkpoint")
	void Configure(int32 InCheckpointId, const FVector& CenterCm, float HalfWidthCm, float HalfHeightCm, bool bInFinishLine);

	UFUNCTION(BlueprintPure, Category = "Checkpoint")
	bool IsFinishLine() const { return bFinishLine; }

protected:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	TObjectPtr<UBoxComponent> TriggerBox;

	/** Temporary visual (scaled cube). Replaced by the checkpoint arch asset in Gate 3. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	TObjectPtr<UStaticMeshComponent> GateVisual;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	int32 CheckpointId = 1;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	bool bFinishLine = false;
};
