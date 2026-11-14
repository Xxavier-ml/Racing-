#include "World/NairobiTrackBuilder.h"

#include "World/NairobiCheckpointGate.h"
#include "World/NairobiRaceTrackData.h"
#include "NairobiRacing.h"

#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "UObject/ConstructorHelpers.h"

ANairobiTrackBuilder::ANairobiTrackBuilder()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = false;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeFinder(TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (CubeFinder.Succeeded())
	{
		CubeMesh = CubeFinder.Object;
	}
}

UStaticMeshComponent* ANairobiTrackBuilder::CreateSlab(
	const FVector& CenterCm,
	const FRotator& Rotation,
	const FVector& SizeCm,
	bool bCollides)
{
	if (CubeMesh == nullptr)
	{
		return nullptr;
	}

	UStaticMeshComponent* Component = NewObject<UStaticMeshComponent>(this);
	if (Component == nullptr)
	{
		return nullptr;
	}

	Component->SetMobility(EComponentMobility::Movable);
	Component->SetStaticMesh(CubeMesh);
	Component->SetCollisionEnabled(bCollides ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
	Component->SetCollisionProfileName(bCollides ? TEXT("BlockAll") : TEXT("NoCollision"));
	Component->SetupAttachment(RootComponent);
	Component->RegisterComponent();
	Component->SetWorldLocationAndRotation(CenterCm, Rotation);
	Component->SetWorldScale3D(SizeCm / 100.f);

	SpawnedGeometry.Add(Component);
	return Component;
}

UStaticMeshComponent* ANairobiTrackBuilder::CreateBox(const FVector& CenterCm, const FVector& SizeCm)
{
	return CreateSlab(CenterCm, FRotator::ZeroRotator, SizeCm, true);
}

void ANairobiTrackBuilder::ClearBuiltGeometry()
{
	for (UStaticMeshComponent* Component : SpawnedGeometry)
	{
		if (Component)
		{
			Component->DestroyComponent();
		}
	}
	SpawnedGeometry.Reset();

	for (ANairobiCheckpointGate* Gate : SpawnedGates)
	{
		if (Gate)
		{
			Gate->Destroy();
		}
	}
	SpawnedGates.Reset();
}

void ANairobiTrackBuilder::BuildTrack(UNairobiRaceTrackData* InTrackData)
{
	if (InTrackData == nullptr || CubeMesh == nullptr || GetWorld() == nullptr)
	{
		UE_LOG(LogNairobiRace, Warning, TEXT("Track builder skipped: missing track data, cube mesh or world."));
		return;
	}

	TrackData = InTrackData;
	ClearBuiltGeometry();

	// Ground plane (placeholder Nairobi terrain).
	CreateSlab(FVector(0.f, 0.f, -120.f), FRotator::ZeroRotator, FVector(70000.f, 70000.f, 40.f), true);

	// Road slab along the racing line.
	int32 SegmentCount = 0;
	for (int32 Index = 0; Index < InTrackData->RacingLineCm.Num(); ++Index)
	{
		const FVector Start = InTrackData->RacingLineCm[Index];
		const FVector End = InTrackData->RacingLineCm[(Index + 1) % InTrackData->RacingLineCm.Num()];
		const FVector Delta = End - Start;
		const float Length = Delta.Size2D();
		if (Length < 50.f)
		{
			continue;
		}

		const FRotator Rotation(0.f, Delta.Rotation().Yaw, 0.f);
		const FVector Center = (Start + End) * 0.5f - FVector(0.f, 0.f, RoadThicknessCm * 0.5f);
		CreateSlab(Center, Rotation, FVector(Length + 200.f, RoadWidthCm, RoadThicknessCm), true);
		++SegmentCount;
	}

	// CBD block-outs: solid AABB colliders matching the migrated building footprints.
	if (bBuildCityBlocks)
	{
		for (const FNairobiCityBlockRow& Block : InTrackData->CityBlocks)
		{
			const FVector Size(Block.HalfWidthCm * 2.0, Block.HalfDepthCm * 2.0, Block.HeightCm);
			const FVector Center(Block.X, Block.Y, Block.HeightCm * 0.5);
			CreateBox(Center, Size);
		}

		// Signature landmark volumes so the skyline reads before real art exists.
		for (const FNairobiLandmarkRow& Landmark : InTrackData->Landmarks)
		{
			if (Landmark.ColliderHalfWCm < 100.0 || Landmark.HeightCm < 1500.0)
			{
				continue;
			}
			const FVector Size(Landmark.ColliderHalfWCm * 2.0, Landmark.ColliderHalfDCm * 2.0, Landmark.HeightCm);
			const FVector Center(Landmark.X, Landmark.Y, Landmark.HeightCm * 0.5);
			CreateBox(Center, Size);
		}
	}

	// Checkpoint gates.
	if (bBuildCheckpoints)
	{
		for (const FNairobiCheckpointRow& Checkpoint : InTrackData->Checkpoints)
		{
			FActorSpawnParameters SpawnParams;
			SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

			ANairobiCheckpointGate* Gate = GetWorld()->SpawnActor<ANairobiCheckpointGate>(
				ANairobiCheckpointGate::StaticClass(),
				FVector(Checkpoint.CenterX, Checkpoint.CenterY, 0.0),
				FRotator::ZeroRotator,
				SpawnParams);

			if (Gate)
			{
				Gate->Configure(
					Checkpoint.Id,
					FVector(Checkpoint.CenterX, Checkpoint.CenterY, 0.0),
					static_cast<float>(Checkpoint.RadiusCm),
					500.f,
					Checkpoint.bIsFinishLine);
				SpawnedGates.Add(Gate);
			}
		}
	}

	UE_LOG(LogNairobiRace, Log,
		TEXT("Track built: %d road segment(s), %d gate(s), %d block-out(s), racing line %.0f m."),
		SegmentCount,
		SpawnedGates.Num(),
		SpawnedGeometry.Num(),
		InTrackData->ComputeRacingLineLengthMeters());
}
