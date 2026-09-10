import React from "react";
import TextEditor from "./components/TextEditor";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { v4 as uuidV4 } from "uuid";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to={`/docs/${uuidV4()}`} />,
  },
  {
    path: "/docs/:id",
    element: <TextEditor />,
  },
]);

const App = () => {
  return <RouterProvider router={router} />;
};

export default App;
