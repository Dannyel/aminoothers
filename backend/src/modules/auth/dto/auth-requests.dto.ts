import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import {
  IsNormalizedEmail,
  IsPassword,
  IsPhone,
  IsRequiredText,
} from '../../../common/validation/validators.js';

export class RegisterCustomerDto {
  @IsNormalizedEmail()
  email: string;

  @IsPassword()
  password: string;

  @IsRequiredText(100)
  firstName: string;

  @IsRequiredText(100)
  lastName: string;

  @IsOptional()
  @IsPhone()
  phone?: string;
}

export class LoginDto {
  @IsNormalizedEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  refreshToken: string;
}

export class EmailDto {
  @IsNormalizedEmail()
  email: string;
}

export class TokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsPassword()
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  @IsPassword()
  newPassword: string;
}
