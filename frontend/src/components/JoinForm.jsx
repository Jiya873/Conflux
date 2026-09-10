import React from "react";

const JoinForm = ({ handleFormSubmit, username, setUsername }) => {
  return (
    <form onSubmit={handleFormSubmit} className="join-form">
      <input
        placeholder="Enter your name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="join-input"
        required
        minLength={1}
        maxLength={50}
      />
      <button type="submit" className="join-button">
        Join Document
      </button>
    </form>
  );
};

export default JoinForm;
