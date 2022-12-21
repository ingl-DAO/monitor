import { IsBoolean, IsEmail, IsString } from "class-validator";
import { ObjectId } from "mongodb";

export class UserPostDto {
    @IsEmail()
    username: string;
  
    @IsString()
    fullname: string;
  
    @IsBoolean()
    is_admin: string;
  }
  
  export class User extends UserPostDto {
    _id: ObjectId;
    password: string;
  }
  
  export enum CollectionName {
    InglState = 'ingl_state',
    BetaUsers = 'ingl_beta_users',
  }