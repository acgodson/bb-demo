import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useInternetIdentity } from "ic-use-internet-identity";
import { useActor } from "./Actors";
import { Principal } from "@dfinity/candid/lib/cjs/idl";
import { BlueBand } from "./blueband";
import { LocalDocumentIndex } from "ic-use-blueband-db";
import { extractTextFromFile } from "./utils";

const App: React.FC = () => {
  const { login, loginStatus, identity } = useInternetIdentity();
  const { actor } = useActor();
  const [index, setIndex] = useState<LocalDocumentIndex | undefined>(undefined);
  const [db, setDB] = useState<BlueBand | null>(null);
  const [parsedContent, setParsedContent] = useState<string | null>(null);
  const [loading, setIsLoading] = useState<boolean>(false);
  const [querying, setQuerying] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [myDocuments, setMyDocuments] = useState<any[] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [isResultsExpanded, setIsResultsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "query">("upload");

  const disabledLogin =
    loginStatus === "logging-in" || loginStatus === "success" || !!identity;
  const disableAdd = !file || loading;
  const disableQuery =
    loading ||
    querying ||
    !myDocuments ||
    (myDocuments && myDocuments.length < 1);

  const addLog = (message: string) => {
    setLogs((prevLogs) => [
      ...prevLogs,
      `[${new Date().toISOString()}] ${message}`,
    ]);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (
      file &&
      (file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx"))
    ) {
      const reader = new FileReader();
      reader.onload = async (e: ProgressEvent<FileReader>) => {
        if (e.target?.result instanceof ArrayBuffer) {
          const data = new Uint8Array(e.target.result);
          const textContent = await extractTextFromFile(data);
          addLog(`Parsed content from file: ${file.name}`);
          setParsedContent(textContent);
          setFile(file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      addLog("Error: Please upload a .docx file");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx", ".doc"],
    },
  });

  useEffect(() => {
    if (db && identity && actor && !index) {
      const collectionId = Principal.valueToString(identity!.getPrincipal());
      initializeIndex(collectionId);
    }
  }, [db, identity, actor, index]);

  useEffect(() => {
    if (identity && actor) {
      const collectionId = Principal.valueToString(identity!.getPrincipal());
      const _db = new BlueBand(actor, collectionId, addLog);
      setDB(_db);
    }
  }, [identity, actor]);

  const initializeIndex = async (collectionId: string) => {
    if (db) {
      const localIndex = await db.initialize();
      setIndex(localIndex);
      addLog(`Initialized local index for collection: ${collectionId}`);
      setCollectionId(collectionId);
    }
  };

  const reset = () => {
    setFile(null);
    setParsedContent(null);
    setMyDocuments(null);
  };

  const AddItem = useCallback(async () => {
    if (!index || !db || !parsedContent || !identity || !file) {
      addLog("Error: Missing required data for adding document");
      return;
    }
    const title = file.split(".doc")[0];
    try {
      setIsLoading(true);
      const result = await db.addDocumentAndVector(index, title, parsedContent);
      addLog(`Document added successfully. ID: ${result.documentId!}`);
      setIsLoading(false);
      reset();
    } catch (e) {
      setIsLoading(false);
      console.error(e);
      addLog(`Error adding document: ${e}`);
    }
  }, [index, db, parsedContent, file, addLog]);

  const QueryItems = useCallback(async () => {
    if (!index || !db || !identity) {
      addLog("Error: Index is not initialized");
      return;
    }
    try {
      setQuerying(true);
      const results = await db.similarityQuery(index, prompt);
      addLog(`Query processed ${results.length} results`);
      setQueryResults(results);
      setQuerying(false);
    } catch (e) {
      addLog(`Error in similarity query: ${e}`);
      setQuerying(false);
    }
  }, [index, db, identity, prompt, addLog]);

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!db || !collectionId) {
        return;
      }
      const result = await db.getDocuments(collectionId);
      if (result) {
        setMyDocuments(result.documents);
      }
    };
    if (db && collectionId && !myDocuments) {
      fetchDocuments();
    }
  }, [db, collectionId, myDocuments]);

  return (
    <div className="layout">
      <div className="selector">
        <div className="heading">
          <div className="logo">Blueband Demo</div>
          <button
            className={disabledLogin ? `disabled` : `active`}
            onClick={disabledLogin ? () => {} : login}
          >
            {disabledLogin ? "Connected" : "Login"}
          </button>
        </div>

        <div className="tabs">
          <div
            className={`tab ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            Upload Document
          </div>
          <div
            className={`tab ${activeTab === "query" ? "active" : ""}`}
            onClick={() => setActiveTab("query")}
          >
            Query Document
          </div>
        </div>

        {activeTab === "upload" && (
          <div className="content">
            <div className="collection-title">
              Collection ID:{" "}
              <span className="principal">
                {identity?.getPrincipal().toText() || ""}
              </span>
            </div>

            {!parsedContent ? (
              <div {...getRootProps()}>
                <input {...getInputProps()} />
                <div className="drop-inset">
                  <p>
                    {isDragActive
                      ? "Drop DOCX file here"
                      : "Drop or click to upload DOCX file"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50">
                <p>{file}</p>
                <p
                  className="text-red-500"
                  onClick={() => setParsedContent(null)}
                >
                  x
                </p>
              </div>
            )}

            <button
              className={!disabledLogin || disableAdd ? `disabled` : `active`}
              onClick={!disabledLogin || disableAdd ? () => {} : AddItem}
            >
              {!loading ? "Add Document" : "Adding..."}
            </button>
          </div>
        )}

        {activeTab === "query" && (
          <>
            <div className="query">
              <div className="collection-title">
                Collection ID:{" "}
                <span className="principal">
                  {identity?.getPrincipal().toText() || ""}
                </span>
              </div>
              <input
                type="text"
                value={prompt}
                placeholder="Enter Keyword or Prompt"
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button
                className={
                  !disabledLogin || disableQuery ? `disabled` : `active`
                }
                onClick={!disabledLogin || disableQuery ? () => {} : QueryItems}
              >
                {!querying ? "Query Document" : "Querying..."}
              </button>
            </div>
            <div>
              <hr />
              <ul>
                {myDocuments &&
                  myDocuments.length > 0 &&
                  myDocuments.map((x, i) => <li key={i}>{x.id}</li>)}
              </ul>
            </div>
          </>
        )}
      </div>

      <div className="results">
        <div className="tab">Console Output</div>
        <div className="console">
          <div className="process-logs">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
          {queryResults.length > 0 && (
            <div className="query-results">
              <div
                className="results-header"
                onClick={() => setIsResultsExpanded(!isResultsExpanded)}
              >
                Query Results {isResultsExpanded ? "▲" : "▼"}
              </div>
              <div
                className={`results-content ${
                  isResultsExpanded ? "expanded" : ""
                }`}
              >
                <ol className="query-results-list">
                  {queryResults &&
                    queryResults.length > 0 &&
                    queryResults.map((result, index) => (
                      <li key={index} className="query-result-item">
                        <div className="result-header">
                          <span className="result-title">{result.title}</span>
                          <span className="result-score">
                            Score: {result.score}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          id={`expand-${index}`}
                          className="expand-toggle"
                        />
                        <label
                          htmlFor={`expand-${index}`}
                          className="expand-label"
                        >
                          Details
                        </label>
                        <div className="result-details">
                          <p>ID: {result.id}</p>
                          <p>Chunks: {result.chunks}</p>
                          {result.sections.map(
                            (section: any, secIndex: number) => (
                              <div key={secIndex} className="section">
                                <p className="section-title">
                                  Section {secIndex + 1}
                                </p>
                                <p className="section-text">{section.text}</p>
                                <p className="section-tokens">
                                  Tokens: {section.tokens}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
