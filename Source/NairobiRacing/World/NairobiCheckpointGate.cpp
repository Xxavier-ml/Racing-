#include "World/NairobiCheckpointGate.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

ANairobiCheckpointGate::ANairobiCheckpointGate()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = true;

	TriggerBox = CreateDefaultSubobject<UBoxComponent>(TEXT("CheckpointVolume"));
	TriggerBox->SetBoxExtent(FVector(300.f, 1400.f, 500.f));
	TriggerBox->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	TriggerBox->SetCollisionResponseToAllChannels(ECR_Ignore);
	TriggerBox->SetCollisionResponseToChannel(ECC_Vehicle, ECR_Overlap);
	TriggerBox->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
	TriggerBox->SetGenerateOverlapEvents(true);
	RootComponent = TriggerBox;

	GateVisual = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("GateVisual"));
	GateVisual->SetupAttachment(TriggerBox);
	GateVisual->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	GateVisual->SetRelativeScale3D(FVector(1.f, 26.f, 10.f));
	GateVisual->SetRelativeLocation(FVector(0.f, 0.f, 400.f));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (CubeMesh.Succeeded())
	{
		GateVisual->SetStaticMesh(CubeMesh.Object);
	}
}

void ANairobiCheckpointGate::Configure(int32 InCheckpointId, const FVector& CenterCm, float HalfWidthCm, float HalfHeightCm, bool bInFinishLine)
{
	CheckpointId = InCheckpointId;
	bFinishLine = bInFinishLine;

	SetActorLocation(CenterCm);
	TriggerBox->SetBoxExtent(FVector(300.f, FMath::Max(200.f, HalfWidthCm), FMath::Max(200.f, HalfHeightCm)));
	GateVisual->SetRelativeScale3D(FVector(0.4f, FMath::Max(1.f, (HalfWidthCm * 2.f) / 100.f), (HalfHeightCm * 2.f) / 100.f));
	GateVisual->SetRelativeLocation(FVector(0.f, 0.f, HalfHeightCm));

	if (GetNetMode() != NM_DedicatedServer)
	{
		// Checkered gates read as finish lines; ordinary gates stay neutral until the
		// arch meshes land in Gate 3.
		GateVisual->SetVisibility(true);
	}
}
