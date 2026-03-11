import { AuthService } from './services/auth-service'
import { ProfileService } from './services/profile-service'
import { AdminUserService } from './services/admin-user-service'

export class UserService {

  static register = AuthService.register
  static setPassword = AuthService.setPassword
  static resendVerification = AuthService.resendVerification

  static getMe = ProfileService.getMe

  static getAdminUsers = AdminUserService.getAdminUsers
  static createAdminUser = AdminUserService.createAdminUser
  static updateAdminUser = AdminUserService.updateAdminUser
  static deleteAdminUser = AdminUserService.deleteAdminUser

}