import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!encryptionKey) {
      throw new Error(
        'CRITICAL: ENCRYPTION_KEY environment variable is not set. ' +
        'Application cannot start without an encryption key. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    if (encryptionKey.length !== 64) {
      throw new Error(
        `CRITICAL: ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ` +
        `Current length: ${encryptionKey.length}. ` +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    if (!/^[a-fA-F0-9]+$/.test(encryptionKey)) {
      throw new Error(
        'CRITICAL: ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f, A-F).'
      );
    }

    this.key = Buffer.from(encryptionKey, 'hex');
  }

  encrypt(plaintext: string): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  decrypt(encrypted: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Store both IV and authTag together for convenience
  encryptToken(token: string): { encryptedToken: string; iv: string } {
    const { encrypted, iv, authTag } = this.encrypt(token);
    // Combine encrypted data and authTag
    return {
      encryptedToken: `${encrypted}:${authTag}`,
      iv,
    };
  }

  decryptToken(encryptedToken: string, iv: string): string {
    const [encrypted, authTag] = encryptedToken.split(':');
    return this.decrypt(encrypted, iv, authTag);
  }
}
