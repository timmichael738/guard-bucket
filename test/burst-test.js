

Promise.all(Array.from({ length: 10 }).map(async () => {
    const apiFetch = await fetch('http://localhost:7000/api/test/rate-limited-call', {
        method: 'POST'
    })

    console.log("API RESPONSE:", await apiFetch.json());
}
));