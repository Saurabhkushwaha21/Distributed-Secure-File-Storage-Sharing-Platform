def register_and_login(client, email="user@example.com", password="SuperSecret1!", full_name="Test User"):
    client.post("/api/v1/auth/register", json={"email": email, "password": password, "full_name": full_name})
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password, "device_info": "pytest"}).json()
    return {"Authorization": f"Bearer {login['access_token']}"}
