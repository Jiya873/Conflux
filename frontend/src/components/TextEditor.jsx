import React from "react";
import JoinForm from "./JoinForm";
import useTextEditor from "../hooks/useTextEditor";
import "quill/dist/quill.snow.css";
import TypingDots from "./UI/TypingDots";

const TextEditor = () => {
  const {
    isReady,
    containerRef,
    users,
    username,
    setUsername,
    handleFormSubmit,
    typingUserId,
    socketError,
  } = useTextEditor();

  if (!isReady) {
    return <JoinForm {...{ username, setUsername, handleFormSubmit }} />;
  }

  return (
    <div className="editor-container">
      <div className="active-users">
        <div className="active-users-title">active users</div>
        <ul className="active-users-content">
          {users.map(({ username, color, id }) => (
            <li
              key={id}
              style={{ color }}
              className="active-users-content-item"
            >
              {username} {id === typingUserId ? <TypingDots /> : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="editor-wrapper" ref={containerRef}></div>
      {socketError && (
        <div className="socket-error">{socketError}</div>
      )}
    </div>
  );
};

export default TextEditor;
