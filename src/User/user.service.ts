import {
  IsBoolean,
  IsEmail,
  IsString,
} from 'class-validator';
import { MongoClient, ObjectId } from 'mongodb';
import * as bcrypt from 'bcrypt';

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

export class UserService {
  private client = new MongoClient(process.env.MONGO_URI);

  async insert(user: UserPostDto) {
    return new Promise((resolve, reject) => {
      this.client.connect(async (err) => {
        if (err) reject(err);
        await this.client.db('monitor_db').command({ ping: 1 });
        const collection = this.client
          .db('monitor_db')
          .collection('ingl_beta_users');
        const password = Math.random().toString(36).slice(2).toUpperCase();
        const insertData = await collection.insertOne({
          ...user,
          password: bcrypt.hashSync(password, Number(process.env.SALT)),
        });
        await this.client.close();
        resolve({ ...insertData, password });
      });
    });
  }

  async update(user: User) {
    return new Promise((resolve, reject) => {
      this.client.connect(async (err) => {
        if (err) reject(err);
        await this.client.db('monitor_db').command({ ping: 1 });
        const collection = this.client
          .db('monitor_db')
          .collection('ingl_beta_users');
        const result = await collection.updateOne(
          { data_id: '7639ca89-e305-4ff4-8031-b47544b7e7a3' },
          {
            $set: user,
          }
        );
        await this.client.close();
        resolve(result);
      });
    });
  }

  async findOne(username: string) {
    return new Promise<User>((resolve, reject) => {
      this.client.connect(async (err) => {
        if (err) reject(err);
        const collection = this.client
          .db('monitor_db')
          .collection('ingl_beta_users');
        const data = await collection.findOne<User>({ username });
        await this.client.close();
        resolve(data);
      });
    });
  }

  async findAll() {
    return new Promise((resolve, reject) => {
      this.client.connect(async (err) => {
        if (err) reject(err);
        const collection = this.client
          .db('monitor_db')
          .collection('ingl_beta_users');
        const data = await collection.find();
        await this.client.close();
        resolve(data);
      });
    });
  }
}