import "@shopify/polaris/build/esm/styles.css";
import { AppProvider, Page} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import App from "./App/App.jsx";
import { useEffect } from "react";

const AppWrapper = () => {

    return (
        <App/>  
    );
};

export default AppWrapper;
