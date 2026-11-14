#include "Audio/NairobiVehicleAudioComponent.h"

#include "Components/AudioComponent.h"
#include "GameFramework/Actor.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundBase.h"
#include "NairobiRacing.h"

const FName UNairobiVehicleAudioComponent::ParamRPM(TEXT("RPM"));
const FName UNairobiVehicleAudioComponent::ParamLoad(TEXT("Load"));
const FName UNairobiVehicleAudioComponent::ParamSpeed(TEXT("Speed"));
const FName UNairobiVehicleAudioComponent::ParamTyreSlip(TEXT("TyreSlip"));

UNairobiVehicleAudioComponent::UNairobiVehicleAudioComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	bAutoActivate = false;
	bIsUISound = false;
	bAllowSpatialization = true;
}

void UNairobiVehicleAudioComponent::BeginPlay()
{
	Super::BeginPlay();

	if (EngineLoopSound.IsNull())
	{
		UE_LOG(LogNairobiVehicle, Verbose, TEXT("Vehicle audio: no engine loop assigned; audio stays silent until assets are authored."));
		return;
	}

	if (USoundBase* Loop = EngineLoopSound.LoadSynchronous())
	{
		SetSound(Loop);
		Play();
		bEngineAudioStarted = true;
	}
}

void UNairobiVehicleAudioComponent::SetEngineAudioProfile(TSoftObjectPtr<USoundBase> InLoopSound, TSoftObjectPtr<USoundBase> InOnLoadSound)
{
	EngineLoopSound = InLoopSound;
	EngineOnLoadSound = InOnLoadSound;
}

void UNairobiVehicleAudioComponent::UpdateEngineParameters(float RPM01, float Load01, float SpeedKph, float Slip01)
{
	if (!bEngineAudioStarted)
	{
		return;
	}

	SetFloatParameter(ParamRPM, FMath::Clamp(RPM01, 0.f, 1.f));
	SetFloatParameter(ParamLoad, FMath::Clamp(Load01, 0.f, 1.f));
	SetFloatParameter(ParamSpeed, FMath::Max(0.f, SpeedKph));
	SetFloatParameter(ParamTyreSlip, FMath::Clamp(Slip01, 0.f, 1.f));
}

void UNairobiVehicleAudioComponent::PlayHorn()
{
	if (USoundBase* Horn = HornSound.LoadSynchronous())
	{
		UGameplayStatics::PlaySoundAtLocation(this, Horn, GetOwner() ? GetOwner()->GetActorLocation() : FVector::ZeroVector);
	}
	else
	{
		UE_LOG(LogNairobiVehicle, Verbose, TEXT("Vehicle audio: horn pressed but no horn sound is assigned."));
	}
}

void UNairobiVehicleAudioComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
}
