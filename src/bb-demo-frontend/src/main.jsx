import React from "react";
import ReactDOM from "react-dom/client";
import { InternetIdentityProvider } from "ic-use-internet-identity";
import App from "./App";
import "./index.scss";
import Actors from "./Actors";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InternetIdentityProvider>
      <Actors>
        <App />
      </Actors>
    </InternetIdentityProvider>
  </React.StrictMode>
);
