  <script>
    let sheetData = [];
    const scriptURL = "https://script.google.com/macros/s/AKfycbxvCXxshI7Nb8k3ETICeV35DhztIb2YTh2qQF9JFrBHq_pfAnhmIihmO_-KjKUn54sl/exec";

    async function fetchData() {
      console.log("Fetching data from Google Sheet...");
      try {
        let response = await fetch(scriptURL);
        sheetData = await response.json();
        console.log("Data fetched successfully:", sheetData);
        renderTopLists();
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }

    function renderTopLists() {
      const leftBox = document.getElementById("left-box");
      const rightBox = document.getElementById("right-box");

      const topAP = [...sheetData]
        .filter(p => !isNaN(p["AP"]))
        .sort((a, b) => b["AP"] - a["AP"])
        .slice(0, 10);

      const topAPGain = [...sheetData]
        .filter(p => !isNaN(p["AP Gain"]))
        .sort((a, b) => b["AP Gain"] - a["AP Gain"])
        .slice(0, 10);

      function createDecoratedDiv(entry, index, valueField) {
        let emojiName;
        if (index === 0) emojiName = "🥇";
        else if (index === 1) emojiName = "🥈";
        else if (index === 2) emojiName = "🥉";
        else emojiName = "🎖️";

        const div = document.createElement("div");
        div.className = "side-box-item";
        div.innerHTML = `<strong>${emojiName}${entry["Name"]}${emojiName}</strong><br>${Number(entry[valueField]).toFixed(2)}`;
        return div;
      }

      leftBox.innerHTML = "<h3>Top Overall AP</h3>";
      topAP.forEach((entry, index) => {
        leftBox.appendChild(createDecoratedDiv(entry, index, "AP"));
      });

      rightBox.innerHTML = "<h3>Top AP Gain</h3>";
      topAPGain.forEach((entry, index) => {
        rightBox.appendChild(createDecoratedDiv(entry, index, "AP Gain"));
      });
    }

    document.getElementById("search").addEventListener("input", searchPerson);
    fetchData();

    function searchPerson() {
      const query = document.getElementById("search").value.toLowerCase();
      const dropdown = document.getElementById("dropdown");
      dropdown.innerHTML = "";
      console.log("Search query:", query);
      if (query.length > 0) {
        const filteredData = sheetData.filter(
          (p) =>
            p["Name"].toLowerCase().includes(query) ||
            (p["ID"] && p["ID"].toString().includes(query))
        );
        console.log("Filtered results:", filteredData);
        dropdown.style.display = filteredData.length > 0 ? "block" : "none";
        filteredData.forEach((person) => {
          const div = document.createElement("div");
          div.textContent = person["Name"] + " (ID: " + person["ID"] + ")";
          div.addEventListener("click", () => {
            document.getElementById("search").value = person["Name"];
            dropdown.style.display = "none";
            console.log("Selected person:", person);
            displayData(person);
          });
          dropdown.appendChild(div);
        });
      } else {
        dropdown.style.display = "none";
      }
    }

    function displayData(person) {
      console.log("Displaying data for:", person);
      let container = document.getElementById("data-container");
      container.innerHTML = "";

      const fields = [
        { field: "AP", label: "AP" },
        { field: "AP Average", label: "AP Average" },
        { field: "AP Gain Average", label: "AP Gain Average" },
        { field: "AP Gain", label: "AP Gain" },
        { field: "Merits", label: "Merits" },
        { field: "Merits Percentage", label: "Merits %" },
        { field: "Merits Gained Percentage", label: "Merits Gained %" },
        { field: "Merits Gained", label: "Merits Gained" },
        { field: "Power Change", label: "Power Change" },
        { field: "Heal Change", label: "Heal Change" },
        { field: "Kill Change", label: "Kill Change" },
        { field: "Death Change", label: "Death Change" },
        { field: "Behemoths", label: "Behemoths" },
        { field: "Weekly Helps", label: "Helps" },
        { field: "Weekly Donations", label: "Donations" },
        { field: "Weekly Build", label: "Build" }
      ];

      const boxElems = fields.map(({ field, label }) => {
        let value = person[field] || "0";
        if (field === "Merits Percentage" && value === "#DIV/0!") {
          value = "0";
        } else if (!isNaN(value)) {
          value = Number(value).toFixed(2);
          if (parseFloat(value) === parseInt(value)) {
            value = parseInt(value).toString();
          }
        }
        const div = document.createElement("div");
        div.className = "data-box";
        div.innerHTML = `<h3>${label}</h3><p>${value}</p>`;
        return div;
      });

      const rssBox = document.createElement("div");
      rssBox.className = "data-box";
      let rssValue = person["Rss Total Season"] || "0";
      if (!isNaN(rssValue)) {
        rssValue = Number(rssValue).toFixed(2);
        if (parseFloat(rssValue) === parseInt(rssValue)) {
          rssValue = parseInt(rssValue).toString();
        }
      }
      rssBox.innerHTML = `<h3>Rss Gather</h3><p>${rssValue}</p>`;

      const runicBox = document.createElement("div");
      runicBox.className = "data-box";
      const runicValue = person["Runic Points Season"] || "0";
      runicBox.innerHTML = `<h3>Runic Points</h3><p>${runicValue}</p>`;

      const rankBox = document.createElement("div");
      rankBox.className = "data-box";
      const rankValue = parseInt(person["Rank"] || "0");
      const totalIDs = sheetData.filter(p => p["ID"]).length;
      rankBox.innerHTML = `<h3>Rank</h3><p>${rankValue} out of ${totalIDs}</p>`;

      const helperBox = document.createElement("div");
      helperBox.className = "data-box";
      let from = (person["Helper 2"] || "").replace(/-2025$/, "");
      let to = (person["Helper 1"] || "").replace(/-2025$/, "");
      helperBox.innerHTML = `<h3>Data Period</h3><p>From ${from} to ${to}</p>`;

      const layout = [
        boxElems.slice(0, 4),
        boxElems.slice(4, 8),
        boxElems.slice(8, 12),
        boxElems.slice(12, 16)
      ];

      layout.forEach((row) => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "row";
        row.forEach((box) => rowDiv.appendChild(box));
        container.appendChild(rowDiv);
      });

      const lastRow = document.createElement("div");
      lastRow.className = "row";
      lastRow.appendChild(rssBox);
      lastRow.appendChild(runicBox);
      lastRow.appendChild(rankBox);
      lastRow.appendChild(helperBox);
      container.appendChild(lastRow);
    }

    // ✅ Add Reset Button to the DOM
    const resetButton = document.createElement("button");
    resetButton.textContent = "Reset";
    resetButton.style.marginTop = "10px";
    resetButton.style.padding = "8px 16px";
    resetButton.style.fontSize = "16px";
    resetButton.style.border = "2px solid black";
    resetButton.style.borderRadius = "5px";
    resetButton.style.cursor = "pointer";
    resetButton.onclick = () => {
      console.log("Resetting view...");
      document.getElementById("search").value = "";
      document.getElementById("data-container").innerHTML = "";
      document.getElementById("dropdown").style.display = "none";
    };
    document.querySelector(".search-container").appendChild(resetButton);
  </script>
