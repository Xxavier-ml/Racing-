#include "Traffic/NairobiTrafficVehicle.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

ANairobiTrafficVehicle::ANairobiTrafficVehicle()
{
	PrimaryActorTick.bCanEverTick = true;
	bReplicates = false; // Traffic is server/standalone local and culled by distance.

	CollisionBox = CreateDefaultSubobject<UBoxComponent>(TEXT("TrafficCollision"));
	CollisionBox->SetBoxExtent(FVector(220.f, 95.f, 80.f));
	CollisionBox->SetCollisionProfileName(TEXT("BlockAllDynamic"));
	CollisionBox->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
	RootComponent = CollisionBox;

	BodyMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("TrafficBody"));
	BodyMesh->SetupAttachment(CollisionBox);
	BodyMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (CubeMesh.Succeeded())
	{
		BodyMesh->SetStaticMesh(CubeMesh.Object);
	}
}

void ANairobiTrafficVehicle::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Movement is driven by ANairobiTrafficManager (lane following, signals, spacing).
}

void ANairobiTrafficVehicle::ActivateArchetype(ENairobiVehicleClass InArchetype)
{
	Archetype = InArchetype;
	ApplyArchetypeVisuals();
}

void ANairobiTrafficVehicle::ApplyArchetypeVisuals()
{
	// Clearly identified temporary geometry: scaled engine cubes with per-archetype
	// dimensions and colours. Production meshes are specified in
	// Documentation/AssetPipeline/ASSET_MANIFEST.csv.
	FVector Extent(220.f, 95.f, 80.f);
	FLinearColor Colour(0.75f, 0.75f, 0.78f, 1.f);

	switch (Archetype)
	{
	case ENairobiVehicleClass::TrafficMatatu:
		Extent = FVector(260.f, 105.f, 120.f);
		Colour = FLinearColor(0.95f, 0.62f, 0.1f, 1.f);
		break;
	case ENairobiVehicleClass::TrafficBodaBoda:
		Extent = FVector(105.f, 45.f, 55.f);
		Colour = FLinearColor(0.2f, 0.75f, 0.5f, 1.f);
		break;
	case ENairobiVehicleClass::TrafficBus:
		Extent = FVector(420.f, 125.f, 160.f);
		Colour = FLinearColor(0.16f, 0.35f, 0.62f, 1.f);
		break;
	case ENairobiVehicleClass::TrafficSaloon:
		Extent = FVector(220.f, 92.f, 75.f);
		Colour = FLinearColor(0.85f, 0.85f, 0.88f, 1.f);
		break;
	case ENairobiVehicleClass::TrafficSafari:
		Extent = FVector(250.f, 100.f, 110.f);
		Colour = FLinearColor(0.25f, 0.3f, 0.26f, 1.f);
		break;
	default:
		break;
	}

	CollisionBox->SetBoxExtent(Extent);
	BodyMesh->SetRelativeScale3D(Extent / 50.f);

	if (UMaterialInstanceDynamic* Dynamic = BodyMesh->CreateAndSetMaterialInstanceDynamic(0))
	{
		Dynamic->SetVectorParameterValue(TEXT("BaseColor"), Colour);
	}

	BaseSpeedMps = FMath::Clamp(Extent.X / 100.f * 2.5f, 8.f, 20.f);
	CurrentSpeedMps = BaseSpeedMps * 0.7f;
}

void ANairobiTrafficVehicle::SetSimulationActive(bool bActive)
{
	bSimulationActive = bActive;
	SetActorTickEnabled(bActive);
	BodyMesh->SetVisibility(bActive, true);
}

void ANairobiTrafficVehicle::AdvanceAlongLane(const FVector& NewLocationCm, float NewYawRadians)
{
	SetActorLocationAndRotation(
		NewLocationCm,
		FRotator(0.f, FMath::RadiansToDegrees(NewYawRadians), 0.f),
		true,
		nullptr,
		ETeleportType::TeleportPhysics);
}
