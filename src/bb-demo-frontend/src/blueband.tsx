import { LocalDocumentIndex } from "ic-use-blueband-db";
import { bb_demo_backend } from "../../declarations/bb-demo-backend/";

// This example uses LocadocumentIndex directly from ic-use-blueband-db. You can wrap your
// app in a bluebandprovider and call the same functions from the useblueband context

export class BlueBand {
  private collectionId: string;
  constructor(
    private actor: any,
    collectionId: string,
    private logFunction?: (message: string) => void
  ) {
    this.collectionId = collectionId;
  }

  private OPENAI_KEY = async () => {
    return await bb_demo_backend.OpenAISecret();
  };

  async log(text: string) {
    if (this.logFunction) {
      this.logFunction(text);
    } else {
      console.log(text);
    }
  }

  async initialize() {
    const isCatalog = await this.IsDocExists(this.collectionId);
    if (this.collectionId) {
      const secret = await this.OPENAI_KEY();
      const config = {
        actor: this.actor,
        indexName: this.collectionId,
        apiKey: secret,
        isCatalog: isCatalog,
        _getDocumentId: this.getDocumentID,
        _getDocumentTitle: this.getDocumentTitle,
        chunkingConfig: {
          chunkSize: 502,
        },
      };

      return new LocalDocumentIndex(config);
    }
  }

  async IsDocExists(collectionId: string) {
    if (!collectionId || !this.actor) return false;
    const info = await this.actor.getMetadataList(collectionId);
    return info && info.length > 0;
  }

  getDocumentID = async (title: string) => {
    if (!this.actor || !this.collectionId)
      throw new Error("Index is not initialized");
    try {
      const info = await this.actor.titleToDocumentID(this.collectionId, title);
      return info[0];
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  getDocumentTitle = async (docId: string) => {
    try {
      if (!this.collectionId) throw new Error("Sign in required");
      const info = await this.actor.documentIDToTitle(this.collectionId, docId);
      return info[0];
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  async addDocumentAndVector(
    index: LocalDocumentIndex,
    title: string,
    parsedContent: string
  ) {
    this.log(`Adding document: ${title}`);

    const result = await this.actor.addDocument(
      this.collectionId,
      title,
      parsedContent
    );
    const bucketPrincipal = result[0]?.collection[0];
    const documentId = result[0]?.documentId[0];

    this.log(
      `Document added. ID: ${documentId}, Bucket: ${bucketPrincipal.toText()}`
    );

    if (!documentId || !bucketPrincipal) {
      throw new Error("Failed to add document");
    }

    const documentResult = await index.addVectors(
      this.collectionId,
      title,
      documentId
    );
    this.log(`Vector added for document. ID: ${documentResult.id}`);

    await this.actor.endUpdate(this.collectionId, documentResult.id);
    this.log("Vector update frozen for document");

    return {
      documentId,
      bucketPrincipal: bucketPrincipal.toText(),
      vectorId: documentResult.id,
    };
  }

  async similarityQuery(index: LocalDocumentIndex, prompt: string) {
    await this.initialize();
    this.log(`Generating embedding for prompt: ${prompt}`);
    const secret = await this.OPENAI_KEY();
    const response = await this.actor.generateEmbeddings([prompt], secret);

    if ("success" in response) {
      const embedding = JSON.parse(response.success).data[0].embedding;
      this.log("Embedding generated successfully");

      const results = await index.queryDocuments(embedding, {
        maxDocuments: 4,
        maxChunks: 512,
      });

      this.log(`Query returned ${results.length} results`);

      return Promise.all(
        results.map(async (result: any) => {
          const sections = await result.renderSections(500, 1, true);
          console.log("assumed title", result.title);
          const id = await this.getDocumentID(result.title);
          return {
            title: result.title,
            id: id,
            score: result.score,
            chunks: result.chunks.length,
            sections: sections.map((section: any) => ({
              text: section.text
                .replace(/\n+/g, "\n")
                .replace(/\n/g, "\\n")
                .replace(/"/g, '\\"'),
              tokens: section.tokenCount,
            })),
          };
        })
      );
    } else {
      throw new Error("Error generating embedding");
    }
  }

  async getDocuments(collectionId: string) {
    if (!collectionId || !this.actor) return;

    const result = await this.actor.getMetadataList(collectionId);
    if (result[0]) {
      const embedding = await this.actor.getIndex(collectionId);
      return { documents: result[0], embedding };
    }
    return { documents: [], embedding: null };
  }
}
