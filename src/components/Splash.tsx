import nexachatLogo from "../assets/logo/nexachat-logo.png";

const Splash = () => {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        backgroundColor: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={nexachatLogo}
        alt="NexaChat"
        style={{
          height: "48px",
          objectFit: "contain",
        }}
      />
    </div>
  );
};

export default Splash;