import { Types } from "mongoose";
import { IEquipment } from "./equipment";
import { IUser } from "../models/userModel";

export interface IFavorite {
  _id: Types.ObjectId;
  customer: Types.ObjectId | IUser;
  equipment: Types.ObjectId | IEquipment;
  createdAt: Date;
  updatedAt: Date;
}
