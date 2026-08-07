(() => {
  const USER_KEY = "ph_user";
  const DEMO_KEY = "ph_portal_demo";

  const authView = document.getElementById("auth-view");
  const servicesView = document.getElementById("services-view");
  const googleBtn = document.getElementById("google-signin");
  const demoBtn = document.getElementById("demo-signin");
  const signOutBtn = document.getElementById("signout-btn");
  const authError = document.getElementById("auth-error");
  const userChip = document.getElementById("user-chip");
  const userAvatar = document.getElementById("user-avatar");
  const userEmail = document.getElementById("user-email");
  const greetName = document.getElementById("greet-name");

  let firebaseReady = null;

  function waitForFirebase() {
    if (window.phFirebaseAuth) return Promise.resolve(window.phFirebaseAuth);
    if (firebaseReady) return firebaseReady;
    firebaseReady = new Promise((resolve) => {
      window.addEventListener(
        "ph-firebase-ready",
        () => resolve(window.phFirebaseAuth),
        { once: true }
      );
      setTimeout(() => resolve(window.phFirebaseAuth || null), 8000);
    });
    return firebaseReady;
  }

  function readUser() {
    try {
      const raw = sessionStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeUser(user) {
    sessionStorage.setItem(
      USER_KEY,
      JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
      })
    );
  }

  function isDemoSession() {
    return sessionStorage.getItem(DEMO_KEY) === "1";
  }

  function setDemoSession(on) {
    if (on) sessionStorage.setItem(DEMO_KEY, "1");
    else sessionStorage.removeItem(DEMO_KEY);
  }

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg || "";
    authError.classList.toggle("hidden", !msg);
  }

  function showServices(user) {
    authView?.classList.add("hidden");
    servicesView?.classList.remove("hidden");
    signOutBtn?.classList.remove("hidden");

    const name =
      user?.displayName?.split(" ")[0] ||
      user?.email?.split("@")[0] ||
      (isDemoSession() ? "there" : "there");
    if (greetName) greetName.textContent = name;

    if (userChip && userAvatar && userEmail) {
      userChip.classList.add("show");
      const label = user?.email || (isDemoSession() ? "Demo access" : "Signed in");
      userEmail.textContent = label;
      userAvatar.textContent = (label[0] || "P").toUpperCase();
    }
  }

  function showAuth() {
    servicesView?.classList.add("hidden");
    authView?.classList.remove("hidden");
    signOutBtn?.classList.add("hidden");
    userChip?.classList.remove("show");
  }

  async function signInGoogle() {
    showError("");
    googleBtn.disabled = true;
    try {
      const fb = await waitForFirebase();
      if (!fb) throw new Error("Authentication is still loading. Try again.");
      const result = await fb.signInWithPopup(fb.auth, fb.googleProvider);
      const user = result.user;
      writeUser(user);
      setDemoSession(false);
      showServices({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") {
        console.error(err);
        showError(err?.message || "Sign-in failed. Please try again.");
      }
    } finally {
      googleBtn.disabled = false;
    }
  }

  function signInDemo() {
    setDemoSession(true);
    writeUser({
      uid: "demo-portal",
      email: "demo@powerhousetech.in",
      displayName: "Demo Client",
    });
    showServices({
      uid: "demo-portal",
      email: "demo@powerhousetech.in",
      displayName: "Demo Client",
    });
  }

  async function signOut() {
    setDemoSession(false);
    sessionStorage.removeItem(USER_KEY);
    try {
      const fb = await waitForFirebase();
      if (fb?.auth?.currentUser) await fb.signOut(fb.auth);
    } catch (err) {
      console.error(err);
    }
    showAuth();
  }

  googleBtn?.addEventListener("click", signInGoogle);
  demoBtn?.addEventListener("click", signInDemo);
  signOutBtn?.addEventListener("click", signOut);

  async function boot() {
    const existing = readUser();
    if (existing?.email) {
      showServices(existing);
    } else {
      showAuth();
    }

    const fb = await waitForFirebase();
    if (!fb) return;
    fb.onAuthStateChanged(fb.auth, (user) => {
      if (user?.email) {
        writeUser(user);
        setDemoSession(false);
        showServices({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });
      } else if (!isDemoSession()) {
        const cached = readUser();
        if (!cached || cached.uid === "demo-portal") showAuth();
      }
    });
  }

  boot();
})();
