import { VoiceAsset, VoiceAssetMetadata } from './types/voice-types';
import { Take } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterVoiceAssetInput {
  id?: string;
  takeId: string;
  relativePath: string;
  filename: string;
  format: 'wav' | 'mp3' | 'ogg';
  sampleRate: number;
  durationSeconds: number;
  metadata: VoiceAssetMetadata;
}

/**
 * Service managing Voice Asset project resources.
 * Strictly limited to asset registration, take association, retrieval, removal,
 * and maintaining project consistency. Does NOT perform voice generation.
 */
export class VoiceAssetManager {
  private assets: Map<string, VoiceAsset> = new Map();

  constructor(initialAssets: VoiceAsset[] = []) {
    for (const asset of initialAssets) {
      this.assets.set(asset.id, { ...asset });
    }
  }

  /**
   * Registers a newly created Voice Asset in the project registry using a project-relative path.
   */
  public registerAsset(input: RegisterVoiceAssetInput): VoiceAsset {
    if (!input.takeId || typeof input.takeId !== 'string') {
      throw new Error('Invalid parameter: takeId is required.');
    }
    if (!input.relativePath || typeof input.relativePath !== 'string') {
      throw new Error('Invalid parameter: relativePath is required.');
    }
    if (input.relativePath.includes(':\\') || input.relativePath.startsWith('/Users/')) {
      console.warn(`[VoiceAssetManager] Warning: relativePath appears to be absolute: ${input.relativePath}`);
    }

    const asset: VoiceAsset = {
      id: input.id || uuidv4(),
      takeId: input.takeId,
      relativePath: input.relativePath,
      filename: input.filename || input.relativePath.split('/').pop() || 'voice.wav',
      format: input.format || 'wav',
      sampleRate: input.sampleRate || 24000,
      durationSeconds: input.durationSeconds || 0,
      metadata: { ...input.metadata },
    };

    this.assets.set(asset.id, asset);
    return asset;
  }

  /**
   * Retrieves a Voice Asset by ID.
   */
  public getAsset(id: string): VoiceAsset | null {
    return this.assets.get(id) || null;
  }

  /**
   * Retrieves all Voice Assets registered for a specific Take ID.
   */
  public getAssetsForTake(takeId: string): VoiceAsset[] {
    return Array.from(this.assets.values()).filter((a) => a.takeId === takeId);
  }

  /**
   * Resolves the active Voice Asset currently linked to a Take.
   */
  public getActiveAssetForTake(take: Take): VoiceAsset | null {
    if (!take) return null;
    if (take.fittedVoiceAssetId) {
      const fitted = this.getAsset(take.fittedVoiceAssetId);
      if (fitted) return fitted;
    }
    if (take.voiceAssetId) {
      return this.getAsset(take.voiceAssetId);
    }
    return null;
  }

  /**
   * Associates a Voice Asset as the active voice asset for a specific Take.
   */
  public associateTake(takeId: string, voiceAssetId: string, takes: Take[]): Take[] {
    const asset = this.getAsset(voiceAssetId);
    if (!asset) {
      throw new Error(`VoiceAsset with ID '${voiceAssetId}' not found.`);
    }

    return takes.map((t) => {
      if (t.id === takeId) {
        return {
          ...t,
          voiceAssetId,
        };
      }
      return t;
    });
  }

  /**
   * Dissociates the active voice asset from a Take without deleting the asset.
   */
  public dissociateTake(takeId: string, takes: Take[]): Take[] {
    return takes.map((t) => {
      if (t.id === takeId) {
        const { voiceAssetId, ...rest } = t;
        return rest as Take;
      }
      return t;
    });
  }

  /**
   * Removes a Voice Asset from the manager and unlinks it from any associated Takes.
   */
  public removeAsset(id: string, takes: Take[]): { updatedTakes: Take[]; removed: boolean } {
    const exists = this.assets.has(id);
    if (!exists) {
      return { updatedTakes: takes, removed: false };
    }

    this.assets.delete(id);
    const updatedTakes = takes.map((t) => {
      if (t.voiceAssetId === id) {
        const { voiceAssetId, ...rest } = t;
        return rest as Take;
      }
      return t;
    });

    return { updatedTakes, removed: true };
  }

  /**
   * Returns all registered Voice Assets in the project.
   */
  public getAllAssets(): VoiceAsset[] {
    return Array.from(this.assets.values());
  }

  /**
   * Deterministically re-hydrates the VoiceAssetManager registry from project Takes metadata.
   * Keeps getAsset() a pure, side-effect-free lookup operation while ensuring all persisted
   * or session takes with a voiceAssetId are registered in the assets Map.
   */
  public rehydrateFromTakes(takes: Take[]): void {
    if (!Array.isArray(takes)) return;
    for (const take of takes) {
      if (!take) continue;
      const assetIdsToRehydrate = [take.voiceAssetId, take.fittedVoiceAssetId].filter(
        (id): id is string => !!id
      );

      for (const assetId of assetIdsToRehydrate) {
        if (this.assets.has(assetId)) continue;

        const extMatch = assetId.match(/\.(wav|mp3|ogg)$/i);
        const format: 'wav' | 'mp3' | 'ogg' = extMatch
          ? (extMatch[1].toLowerCase() as 'wav' | 'mp3' | 'ogg')
          : assetId.includes('.mp3')
          ? 'mp3'
          : 'wav';

        const filename = assetId.endsWith(`.${format}`)
          ? assetId
          : `${assetId}.${format}`;

        const relativePath = assetId.startsWith('Audio/')
          ? assetId
          : `Audio/${filename}`;

        this.registerAsset({
          id: assetId,
          takeId: take.id,
          relativePath,
          filename,
          format,
          sampleRate: 24000,
          durationSeconds: 0,
          metadata: {
            generatorProviderId: 'rehydrated',
            generatorModelName: 'rehydrated',
            generatedAt: new Date().toISOString(),
            isAdjusted: assetId === take.fittedVoiceAssetId,
          },
        });
      }
    }
  }

  /**
   * Directly re-hydrates the VoiceAssetManager registry from a persisted voiceAssets collection.
   * Project metadata is the single authoritative source of truth.
   */
  public rehydrateFromAssets(assets: VoiceAsset[]): void {
    if (!Array.isArray(assets)) return;
    for (const asset of assets) {
      if (!asset || !asset.id) continue;
      this.assets.set(asset.id, { ...asset });
    }
  }
}
