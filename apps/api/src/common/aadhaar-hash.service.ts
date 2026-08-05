import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";

@Injectable()
export class AadhaarHashService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>("AADHAAR_HASH_SECRET");
  }

  hash(aadhaarNumber: string): string {
    return createHmac("sha256", this.secret).update(aadhaarNumber).digest("hex");
  }

  last4(aadhaarNumber: string): string {
    return aadhaarNumber.slice(-4);
  }
}
