import { Injectable } from '@angular/core'
import { Diagnostic } from '@ionic-native/diagnostic/ngx'
import { AlertController, Platform } from '@ionic/angular'

import { ErrorCategory, handleErrorSentry } from '../sentry-error-handler/sentry-error-handler'

export enum PermissionStatus {
  GRANTED = 'GRANTED',
  NOT_REQUESTED = 'NOT_REQUESTED',
  DENIED_ALWAYS = 'DENIED_ALWAYS',
  DENIED = 'DENIED',
  UNKNOWN = 'UNKNOWN'
}

export enum PermissionTypes {
  CAMERA = 'CAMERA',
  MICROPHONE = 'MICROPHONE'
}

@Injectable({
  providedIn: 'root'
})
export class PermissionsProvider {
  constructor(private readonly platform: Platform, private readonly diagnostic: Diagnostic, private readonly alertCtrl: AlertController) {}

  public async hasCameraPermission(): Promise<PermissionStatus> {
    const permission: string = await this.diagnostic.getCameraAuthorizationStatus(false)

    return this.getPermissionStatus(permission)
  }

  public async requestPermissions(permissions: PermissionTypes[]): Promise<void> {
    if (this.platform.is('android')) {
      const permissionsToRequest: string[] = []
      if (permissions.indexOf(PermissionTypes.CAMERA) >= 0) {
        permissionsToRequest.push(this.diagnostic.permission.CAMERA)
      }
      await this.diagnostic.requestRuntimePermissions(permissionsToRequest)
    } else if (this.platform.is('ios')) {
      if (permissions.indexOf(PermissionTypes.CAMERA) >= 0) {
        await this.diagnostic.requestCameraAuthorization(false)
      }
    } else {
      console.warn('requesting permission in browser')
    }
  }

  /**
   * The user actively wants to give permissions. This means we first check if we
   * can ask him for the permissions natively, otherwise we show an alert with a
   * link to the settings.
   */
  public async userRequestsPermissions(permissions: PermissionTypes[]): Promise<void> {
    let canRequestPermission: boolean = false
    for (const p of permissions) {
      canRequestPermission = (await this.canAskForPermission(p)) || canRequestPermission
    }
    if (canRequestPermission) {
      await this.requestPermissions(permissions)
    } else {
      await this.showSettingsAlert()
    }
  }

  public async showSettingsAlert(): Promise<void> {
    await this.showAlert('Settings', 'You can enable the missing permissions in the device settings.')
  }

  private async canAskForPermission(permission: PermissionTypes): Promise<boolean> {
    let canAskForPermission: boolean = true
    if (this.platform.is('android')) {
      if (permission === PermissionTypes.CAMERA) {
        const permissionStatus: PermissionStatus = await this.hasCameraPermission()
        canAskForPermission = !(permissionStatus === PermissionStatus.DENIED_ALWAYS)
      }
    } else if (this.platform.is('ios')) {
      if (permission === PermissionTypes.CAMERA) {
        const permissionStatus: PermissionStatus = await this.hasCameraPermission()
        canAskForPermission = !(permissionStatus === PermissionStatus.DENIED)
      }
    }

    return canAskForPermission
  }

  private async getPermissionStatus(permission: string): Promise<PermissionStatus> {
    if (this.isGranted(permission)) {
      return PermissionStatus.GRANTED
    } else if (this.isNotRequested(permission)) {
      return PermissionStatus.NOT_REQUESTED
    } else if (this.isDeniedAlways(permission)) {
      return PermissionStatus.DENIED_ALWAYS
    } else if (this.isDenied(permission)) {
      return PermissionStatus.DENIED
    } else {
      return PermissionStatus.UNKNOWN
    }
  }

  private async showAlert(title: string, message: string): Promise<void> {
    const alert: HTMLIonAlertElement = await this.alertCtrl.create({
      header: title,
      message,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Open settings',
          handler: (): void => {
            this.diagnostic.switchToSettings().catch(handleErrorSentry(ErrorCategory.CORDOVA_PLUGIN))
          }
        }
      ]
    })
    alert.present().catch(handleErrorSentry(ErrorCategory.IONIC_ALERT))
  }

  private isGranted(permission: string): boolean {
    return permission === this.diagnostic.permissionStatus.GRANTED || permission === this.diagnostic.permissionStatus.GRANTED_WHEN_IN_USE
  }

  private isNotRequested(permission: string): boolean {
    return permission === this.diagnostic.permissionStatus.NOT_REQUESTED
  }

  private isDeniedAlways(permission: string): boolean {
    return permission === this.diagnostic.permissionStatus.DENIED_ALWAYS || permission === this.diagnostic.permissionStatus.RESTRICTED
  }

  private isDenied(permission: string): boolean {
    return !(this.isGranted(permission) || this.isNotRequested(permission))
  }
}
