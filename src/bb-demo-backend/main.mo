import Error "mo:base/Error";
import Debug "mo:base/Debug";
import Cycles "mo:base/ExperimentalCycles";
import Principal "mo:base/Principal";
import ENV "mo:env";

import BluebandProvider "./blueband";

shared ({ caller }) actor class Main() {

  // Type aliases
  public type StoreId = BluebandProvider.DocumentId;
  type VectorStore = BluebandProvider.VectorStore;
  type Metadata = BluebandProvider.MetadataList;
  type DocumentInfo = BluebandProvider.DocumentMetadata;
  public type Collection = BluebandProvider.Collection;

  // Blueband db Canister
  private stable var BluebandProviderCanister : ?BluebandProvider.BluebandProvider = null;

  // Initialize db canister
  public func initBluebandProviderCanister(cannister : Principal) : async () {
    BluebandProviderCanister := ?actor (Principal.toText(cannister)) : ?BluebandProvider.BluebandProvider;
  };

  // Use openai secret
  public query func OpenAISecret() : async Text {
    return ENV.OPENAI_SECRET;
  };

  // Get Database Provider (add auth in production)
  private func getDB() : async BluebandProvider.BluebandProvider {
    switch (BluebandProviderCanister) {
      case (null) {
        throw Error.reject("No BluebandProvider Canister found");
      };
      case (?db) { return db };
    };
  };

  // get a collection Principal
  public func myStorePrincipal(storeId : Text) : async ?Principal {
    let db = await getDB();
    await db.getCollectionPrincipal(storeId);
  };

  // Save raw document
  public func addDocument(collectionId : Text, title : Text, content : Text) : async ?({
    bucket : ?Principal;
    documentId : ?Text;
  }) {
    let db = await getDB();
    let result = await db.addDocument(collectionId, title, content);

    switch (result) {
      case (?{ collection; documentId }) {
        ?{ bucket = collection; documentId = documentId };
      };
      case (null) {
        throw Error.reject("Failed to add document");
      };
    };
  };

  // Save vector
  public func addVector(
    collectionId : Text,
    docId : Text,
    vector_id : Text,
    start : Nat,
    end : Nat,
    vector : [Float],
  ) : async Text {
    let db = await getDB();
    await db.putVector(
      collectionId,
      docId,
      vector_id,
      start,
      end,
      vector,
    );
  };

  // Freeze vector update for document
  public func endUpdate(collectionId : Text, docId : Text) : async () {
    let db = await getDB();
    await db.endUpdate(collectionId, docId);
  };

  ///////////////////////////
  // DB Read Functions
  //////////////////////////

  // return vectors
  public func getIndex(storeId : Text) : async ?{ items : VectorStore } {
    let db = await getDB();
    await db.getIndex(storeId);
  };

  // return document infos
  public func metadata(storeId : Text) : async ?Metadata {
    let db = await getDB();
    return await db.getMetadataList(storeId);
  };

  // return document
  public func getChunks(storeId : Text, docId : Text) : async ?Text {
    let db = await getDB();
    return await db.getChunks(storeId, docId);
  };

  //return  single document info
  public func getMetadata(storeId : Text, docId : Text) : async ?DocumentInfo {
    let db = await getDB();
    return await db.getMetadata(storeId, docId);
  };

  //return document id from vector id
  public shared func getDocumentId(storeId : Text, vectorId : Text) : async ?Text {
    let db = await getDB();
    return await db.getDocumentId(storeId, vectorId);
  };

  //return document tille from document id
  public shared func documentIDToTitle(storeId : Text, docId : Text) : async ?Text {
    let db = await getDB();
    return await db.documentIDToTitle(storeId, docId);
  };

  //return document tille from document id
  public shared func titleToDocumentID(storeId : Text, docId : Text) : async ?Text {
    let db = await getDB();
    return await db.titleToDocumentID(storeId, docId);
  };

  // Cycles
  public shared ({ caller = caller }) func wallet_receive() : async () {
    ignore Cycles.accept<system>(Cycles.available());
    Debug.print("intital cycles deposited by " # debug_show (caller));
  };

};
