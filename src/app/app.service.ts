import { deserialize, serialize } from '@dao-xyz/borsh';
import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
  AccountMeta,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction
} from '@solana/web3.js';
import BN from 'bn.js';
import {
  COLLECTION_HOLDER_KEY,
  Config,
  forwardLegacyTransaction,
  GENERAL_ACCOUNT_SEED,
  INGL_CONFIG_SEED,
  INGL_MINT_AUTHORITY_KEY,
  INGL_NFT_COLLECTION_KEY,
  INGL_REGISTRY_PROGRAM_ID,
  INGL_TEAM_ID,
  Init,
  MAX_PROGRAMS_PER_STORAGE_ACCOUNT,
  METAPLEX_PROGRAM_ID, toBytesInt32,
  UploadUris,
  URIS_ACCOUNT_SEED
} from '../state';
import { Rarity, RegisterValidatorDto } from './app.dto';

@Injectable()
export class AppService {
  private readonly headers = {
    'Content-Type': 'application/json',
    'api-key': process.env.REGISTRY_PROGRAMS_API_KEY,
  };
  private readonly requestBody = {
    collection: 'program_list',
    database: 'programs',
    dataSource: 'Cluster0',
    filter: {
      Is_used: false,
    },
  };
  constructor(
    private readonly connection: Connection,
    private readonly httpService: HttpService
  ) {
    if (!this.headers['api-key'])
      throw new HttpException('No API key found', HttpStatus.FAILED_DEPENDENCY);
  }

  getData(): { message: string } {
    return { message: 'Welcome to Ingl monitor!' };
  }

  async findPrograms() {
    const { data } = await this.httpService.axiosRef.post<{
      documents: {
        _id: string;
        program: string;
        Is_used: boolean;
      }[];
    }>(
      'https://data.mongodb-api.com/app/data-ywjjx/endpoint/data/v1/action/find',
      this.requestBody,
      {
        headers: this.headers,
      }
    );
    return data.documents;
  }

  async findProgramId() {
    const programs = await this.findPrograms();
    for (let i = 0; i < programs.length; i++) {
      const { program } = programs[i];
      const programKey = new PublicKey(program);
      const programAccount = await this.connection.getAccountInfo(programKey);
      if (programAccount && programAccount.executable) {
        const [configAccountKey] = PublicKey.findProgramAddressSync(
          [Buffer.from(INGL_CONFIG_SEED)],
          programKey
        );
        const configAccount = await this.connection.getAccountInfo(
          configAccountKey
        );
        if (!configAccount) return programKey.toBase58();
      }
    }
    return null;
  }

  async useProgramId(programId: string) {
    await this.httpService.axiosRef.post<{
      document?: {
        _id: string;
        program: string;
        Is_used: boolean;
      };
    }>(
      'https://data.mongodb-api.com/app/data-ywjjx/endpoint/data/v1/action/updateOne',
      {
        ...this.requestBody,
        filter: {
          program: programId,
        },
        update: {
          $set: {
            Is_used: true,
          },
        },
      },
      {
        headers: this.headers,
      }
    );
  }

  async registerValidator({
    validator_id,
    ...newValidator
  }: RegisterValidatorDto) {
    const programId = await this.findProgramId();
    if (!programId)
      throw new HttpException(
        'No predeployed program available',
        HttpStatus.EXPECTATION_FAILED
      );
    const programPubkey = new PublicKey(programId);

    const keypairBuffer = Buffer.from(
      JSON.parse(process.env.BACKEND_KEYPAIR as string)
    );
    const payerKeypair = Keypair.fromSecretKey(keypairBuffer);

    const payerAccount: AccountMeta = {
      pubkey: payerKeypair.publicKey,
      isSigner: true,
      isWritable: true,
    };

    const validatorAccount: AccountMeta = {
      pubkey: new PublicKey(validator_id),
      isWritable: false,
      isSigner: false,
    };

    const [inglConfigKey] = PublicKey.findProgramAddressSync(
      [Buffer.from(INGL_CONFIG_SEED)],
      programPubkey
    );
    const configAccount: AccountMeta = {
      pubkey: inglConfigKey,
      isSigner: false,
      isWritable: true,
    };
    const [urisAccountKey] = PublicKey.findProgramAddressSync(
      [Buffer.from(URIS_ACCOUNT_SEED)],
      programPubkey
    );
    const urisAccount: AccountMeta = {
      isSigner: false,
      isWritable: true,
      pubkey: urisAccountKey,
    };

    const [inglNftCollectionMintKey] = PublicKey.findProgramAddressSync(
      [Buffer.from(INGL_NFT_COLLECTION_KEY)],
      programPubkey
    );

    const collectionMintAccount: AccountMeta = {
      pubkey: inglNftCollectionMintKey,
      isSigner: false,
      isWritable: true,
    };

    const [collectionAutorityKey] = PublicKey.findProgramAddressSync(
      [Buffer.from(INGL_MINT_AUTHORITY_KEY)],
      programPubkey
    );

    const mintAuthorityAccount: AccountMeta = {
      pubkey: collectionAutorityKey,
      isSigner: false,
      isWritable: true,
    };

    const splTokenProgramAccount: AccountMeta = {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    };

    const sysvarRentAccount: AccountMeta = {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    };

    const systemProgramAccount: AccountMeta = {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    };

    const [metaplexAccountKey] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        METAPLEX_PROGRAM_ID.toBuffer(),
        collectionMintAccount.pubkey.toBuffer(),
      ],
      METAPLEX_PROGRAM_ID
    );

    const collectionMetadataAccount: AccountMeta = {
      pubkey: metaplexAccountKey,
      isSigner: false,
      isWritable: true,
    };

    const [generalAccountPubkey] = PublicKey.findProgramAddressSync(
      [Buffer.from(GENERAL_ACCOUNT_SEED)],
      programPubkey
    );

    const generalAccount: AccountMeta = {
      pubkey: generalAccountPubkey,
      isSigner: false,
      isWritable: true,
    };

    const metaplexProgramAccount: AccountMeta = {
      pubkey: METAPLEX_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    };

    const [inglCollectionHolderKey] = PublicKey.findProgramAddressSync(
      [Buffer.from(COLLECTION_HOLDER_KEY)],
      programPubkey
    );
    const collectionHolderAccount: AccountMeta = {
      pubkey: inglCollectionHolderKey,
      isSigner: false,
      isWritable: true,
    };
    const associatedTokenAccount: AccountMeta = {
      pubkey: getAssociatedTokenAddressSync(
        inglNftCollectionMintKey,
        inglCollectionHolderKey,
        true
      ),
      isSigner: false,
      isWritable: true,
    };

    const [editionKey] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        METAPLEX_PROGRAM_ID.toBuffer(),
        inglNftCollectionMintKey.toBuffer(),
        Buffer.from('edition'),
      ],
      METAPLEX_PROGRAM_ID
    );
    const collectionEditionAccount: AccountMeta = {
      pubkey: editionKey,
      isSigner: false,
      isWritable: true,
    };

    const associatedTokeProgramAccount: AccountMeta = {
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    };
    const InglRegistryProgramAccount: AccountMeta = {
      pubkey: INGL_REGISTRY_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    };
    const [registryConfigKey] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      INGL_REGISTRY_PROGRAM_ID
    );
    const registryConfigAccount: AccountMeta = {
      pubkey: registryConfigKey,
      isSigner: false,
      isWritable: true,
    };
    const registryAccountInfo = await this.connection.getAccountInfo(
      registryConfigKey
    );
    if (!registryAccountInfo)
      throw Error('Vlidator registration not possible yet.');
    const { validation_number } = deserialize(registryAccountInfo.data, Config);
    const storageNumeration = Math.floor(
      validation_number / MAX_PROGRAMS_PER_STORAGE_ACCOUNT
    );
    const [storageKey] = PublicKey.findProgramAddressSync(
      [Buffer.from('storage'), toBytesInt32(storageNumeration)],
      INGL_REGISTRY_PROGRAM_ID
    );
    const storageAccount: AccountMeta = {
      pubkey: storageKey,
      isSigner: false,
      isWritable: true,
    };

    const teamAccount: AccountMeta = {
      pubkey: INGL_TEAM_ID,
      isSigner: false,
      isWritable: true,
    };

    const programAccount: AccountMeta = {
      pubkey: programPubkey,
      isSigner: false,
      isWritable: false,
    };

    const {
      unit_backing: solBacking,
      max_primary_stake,
      governance_expiration_time,
      creator_royalties,
      rarities,
      ...registratioData
    } = newValidator;

    const log_level = 0;
    const initProgramPayload = new Init({
      log_level,
      ...registratioData,
      rarities: rarities.map((_) => _.rarity),
      creator_royalties: creator_royalties * 100,
      unit_backing: new BN(solBacking * LAMPORTS_PER_SOL),
      max_primary_stake: new BN(max_primary_stake * LAMPORTS_PER_SOL),
      governance_expiration_time: governance_expiration_time * (24 * 3600),
    });
    const initProgramInstruction = new TransactionInstruction({
      programId: programPubkey,
      data: Buffer.from(serialize(initProgramPayload)),
      keys: [
        payerAccount,
        configAccount,
        generalAccount,
        urisAccount,
        sysvarRentAccount,
        validatorAccount,
        collectionHolderAccount,
        collectionMintAccount,
        mintAuthorityAccount,
        associatedTokenAccount,
        collectionMetadataAccount,
        collectionEditionAccount,
        splTokenProgramAccount,
        systemProgramAccount,
        registryConfigAccount,
        programAccount,
        teamAccount,
        storageAccount,

        systemProgramAccount,
        splTokenProgramAccount,
        associatedTokeProgramAccount,
        metaplexProgramAccount,
        InglRegistryProgramAccount,
      ],
    });
    const uploadUrisInstructions = this.createUploadUriInst(
      programPubkey,
      [payerAccount, configAccount, urisAccount],
      rarities
    );
    try {
      const signature = await forwardLegacyTransaction({
        instructions: [initProgramInstruction],
        signerKeypairs: [payerKeypair],
        options: {
          additionalUnits: 400_000,
        },
      });
      this.useProgramId(programPubkey.toBase58());
      const upladUriSignatures = await Promise.all(
        uploadUrisInstructions.map((instruction) =>
          forwardLegacyTransaction({
            instructions: [instruction],
            signerKeypairs: [payerKeypair],
            options: {
              additionalUnits: 400_000,
            },
          })
        )
      );
      return [signature, ...upladUriSignatures];
    } catch (error) {
      throw new HttpException(
        `Validator program registration failed with the following errors: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  createUploadUriInst(
    programId: PublicKey,
    accounts: [AccountMeta, AccountMeta, AccountMeta],
    rarities: Rarity[]
  ) {
    return rarities.map(({ rarity, uris }) => {
      const uploadInst = new UploadUris({
        uris,
        rarity,
        log_level: 0,
      });
      return new TransactionInstruction({
        programId,
        data: Buffer.from(serialize(uploadInst)),
        keys: accounts,
      });
    });
  }
}