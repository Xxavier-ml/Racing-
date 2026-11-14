#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NairobiTrackBuilder.generated.h"

class ANairobiCheckpointGate;
class UNairobiRaceTrackData;
class UStaticMesh;
class UStaticMeshComponent;

/**
 * Procedural greybox builder for the migrated Nairobi circuit.
 *
 * This exists so the vertical slice is drivable before any bespoke environment art is
 * authored: it lays a road slab along the racing line, blocks out the CBD footprints and
 * spawns checkpoint gates, all from UNairobiRaceTrackData.
 *
 * The geometry is explicitly placeholder (engine cube meshes) and is replaced by modular
 * environment assets in Gate 3. It is NOT presented as finished artwork.
 */
UCLASS()
class NAIROBIRACING_API ANairobiTrackBuilder : public AActor
{
	GENERATED_BODY()

public:
	ANairobiTrackBuilder();

	/** Rebuilds all generated geometry from the track asset. Safe to call repeatedly. */
	UFUNCTION(BlueprintCallable, Category = "Track")
	void BuildTrack(UNairobiRaceTrackData* InTrackData);

	UFUNCTION(BlueprintCallable, Category = "Track")
	void ClearBuiltGeometry();

	UFUNCTION(BlueprintPure, Category = "Track")
	int32 GetGeneratedComponentCount() const { return SpawnedGeometry.Num(); }

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	float RoadWidthCm = 1600.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	float RoadThicknessCm = 40.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	bool bBuildCityBlocks = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	bool bBuildCheckpoints = true;

protected:
	UStaticMeshComponent* CreateSlab(const FVector& CenterCm, const FRotator& Rotation, const FVector& SizeCm, bool bCollides);
	UStaticMeshComponent* CreateBox(const FVector& CenterCm, const FVector& SizeCm);

	UPROPERTY()
	TObjectPtr<UStaticMesh> CubeMesh;

	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> SpawnedGeometry;

	UPROPERTY()
	TArray<TObjectPtr<ANairobiCheckpointGate>> SpawnedGates;

	UPROPERTY()
	TObjectPtr<UNairobiRaceTrackData> TrackData;
};
