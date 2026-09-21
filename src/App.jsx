import { useEffect, useRef, useState } from "react";
import XLSX from "xlsx-js-style";
import { supabase } from "./supabaseClient";

const PROCESS_OPTIONS = [
  "담당 부서(파트) 인계",
  "공조기 가동 / 중지",
  "공조기 설정 변경",
  "현장 조치 완료",
];

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [userRole, setUserRole] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [roleLoading, setRoleLoading] = useState(false);

  const isAdmin = userRole === "admin";
  const isViewer = !isAdmin;

  const [list, setList] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [receiver, setReceiver] = useState("");

  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("미처리");
  const [quickProcess, setQuickProcess] = useState([]);
  const [extraProcess, setExtraProcess] = useState("");

  const [filterStatus, setFilterStatus] = useState("전체");
  const [searchTerm, setSearchTerm] = useState("");

  const [page, setPage] = useState(1);
  const perPage = 10;

  const fileInputRef = useRef(null);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setAuthLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadUserRole(session.user.id);
      loadComplaints();
    } else {
      setList([]);
      setUserRole(null);
      setDisplayName("");
      setSelected(null);
    }
  }, [session]);

  async function loadUserRole(userId) {
    setRoleLoading(true);

    const { data, error } = await supabase
      .from("user_roles")
      .select("role, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    setRoleLoading(false);

    if (error) {
      console.error("권한 확인 오류:", error);
      setUserRole("viewer");
      setDisplayName("사용자");
      return;
    }

    if (!data) {
      setUserRole("viewer");
      setDisplayName("읽기 전용");
      return;
    }

    setUserRole(data.role || "viewer");
    setDisplayName(data.display_name || "");
  }

  async function handleLogin(e) {
    e.preventDefault();

    const cleanId = loginId.trim().toLowerCase();

    if (!cleanId || !loginPassword) {
      alert("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    const email = cleanId.includes("@")
      ? cleanId
      : `${cleanId}@minwon.local`;

    setLoginLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: loginPassword,
    });

    setLoginLoading(false);

    if (error) {
      console.error(error);
      alert("로그인에 실패했습니다.\n아이디 또는 비밀번호를 확인해주세요.");
      return;
    }

    setLoginPassword("");
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("로그아웃 중 오류가 발생했습니다.");
    }
  }

  async function loadComplaints() {
    setDataLoading(true);

    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    setDataLoading(false);

    if (error) {
      console.error(error);
      alert(`민원 데이터를 불러오지 못했습니다.\n${error.message}`);
      return;
    }

    const converted = (data || []).map(dbRowToItem);

    setList(converted);

    setSelected((prev) => {
      if (!prev) return null;

      return (
        converted.find((item) => item.number === prev.number) ||
        null
      );
    });
  }

  function dbRowToItem(row) {
    return {
      id: row.id,
      number: row.number || "",
      date: row.date || "",
      fullDate: row.full_date || "",
      name: row.name || "",
      content: row.content || "",
      receiver: row.receiver || "",
      process: row.process || "",
      status: row.status || "미처리",
      createdAt: row.created_at,
    };
  }

  function getShortDate(dateObj = new Date()) {
    const MM = String(dateObj.getMonth() + 1).padStart(2, "0");
    const DD = String(dateObj.getDate()).padStart(2, "0");
    const hh = String(dateObj.getHours()).padStart(2, "0");
    const mm = String(dateObj.getMinutes()).padStart(2, "0");

    return `${MM}-${DD} ${hh}:${mm}`;
  }

  function getTodayString() {
    const now = new Date();

    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, "0");
    const DD = String(now.getDate()).padStart(2, "0");

    return `${YYYY}-${MM}-${DD}`;
  }

  async function saveData() {
    if (!isAdmin) {
      alert("읽기 전용 계정에서는 등록할 수 없습니다.");
      return;
    }

    if (!name.trim()) {
      alert("신고자 이름을 입력해주세요.");
      return;
    }

    if (!content.trim()) {
      alert("민원 내용을 입력해주세요.");
      return;
    }

    const now = new Date();

    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    const todayPrefix = `${yy}${mm}${dd}`;

    const todayItems = list.filter((item) =>
      item.number?.startsWith(todayPrefix)
    );

    const maxSeq = todayItems.reduce((max, item) => {
      const parts = item.number.split("-");
      const numPart =
        parts.length > 1 ? parseInt(parts[1], 10) : 0;

      return !isNaN(numPart) && numPart > max
        ? numPart
        : max;
    }, 0);

    const nextSeq = String(maxSeq + 1).padStart(3, "0");
    const number = `${todayPrefix}-${nextSeq}`;

    const newData = {
      id: Date.now(),
      number,
      date: getShortDate(now),
      full_date: now.toLocaleString("ko-KR"),
      name: name.trim(),
      content: content.trim(),
      receiver: receiver.trim(),
      process: "",
      status: "미처리",
    };

    const { error } = await supabase
      .from("complaints")
      .insert(newData);

    if (error) {
      console.error(error);
      alert(`민원 저장에 실패했습니다.\n${error.message}`);
      return;
    }

    setName("");
    setContent("");
    setReceiver("");
    setPage(1);

    await loadComplaints();
  }

  function selectItem(item) {
    setSelected(item);

    const savedProcess = item.process || "";

    const parts = savedProcess
      .split(" · ")
      .map((v) => v.trim())
      .filter(Boolean);

    const selectedQuick = parts.filter((part) =>
      PROCESS_OPTIONS.includes(part)
    );

    const remainingText = parts
      .filter((part) => !PROCESS_OPTIONS.includes(part))
      .join(" · ");

    setQuickProcess(selectedQuick);
    setExtraProcess(remainingText);
    setStatus(item.status || "미처리");
  }

  function toggleQuickProcess(value) {
    if (!isAdmin) return;

    setQuickProcess((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  }

  async function updateData() {
    if (!isAdmin) {
      alert("읽기 전용 계정에서는 수정할 수 없습니다.");
      return;
    }

    if (!selected) return;

    const finalProcess = [
      ...quickProcess,
      extraProcess.trim(),
    ]
      .filter(Boolean)
      .join(" · ");

    const { error } = await supabase
      .from("complaints")
      .update({
        process: finalProcess,
        status,
      })
      .eq("number", selected.number);

    if (error) {
      console.error(error);
      alert(`수정에 실패했습니다.\n${error.message}`);
      return;
    }

    setSelected(null);
    setQuickProcess([]);
    setExtraProcess("");

    await loadComplaints();

    alert("처리 내용이 저장되었습니다.");
  }

  async function deleteData(number) {
    if (!isAdmin) {
      alert("읽기 전용 계정에서는 삭제할 수 없습니다.");
      return;
    }

    if (!window.confirm("정말 삭제하시겠습니까?")) {
      return;
    }

    const { error } = await supabase
      .from("complaints")
      .delete()
      .eq("number", number);

    if (error) {
      console.error(error);
      alert(`삭제에 실패했습니다.\n${error.message}`);
      return;
    }

    if (selected?.number === number) {
      setSelected(null);
      setQuickProcess([]);
      setExtraProcess("");
    }

    await loadComplaints();
  }

  const todayShort = getTodayString().slice(5);

  const todayCount = list.filter((item) =>
    item.date?.startsWith(todayShort)
  ).length;

  const pendingCount = list.filter(
    (item) => item.status === "미처리"
  ).length;

  const progressCount = list.filter(
    (item) => item.status === "진행중"
  ).length;

  const completeCount = list.filter(
    (item) => item.status === "처리완료"
  ).length;

  const filteredList = list.filter((item) => {
    const matchesStatus =
      filterStatus === "전체" ||
      item.status === filterStatus;

    const keyword = searchTerm.toLowerCase();

    const matchesSearch =
      (item.name || "").toLowerCase().includes(keyword) ||
      (item.content || "").toLowerCase().includes(keyword) ||
      (item.number || "").toLowerCase().includes(keyword) ||
      (item.process || "").toLowerCase().includes(keyword);

    return matchesStatus && matchesSearch;
  });

  const totalPages =
    Math.ceil(filteredList.length / perPage) || 1;

  const currentList = filteredList.slice(
    (page - 1) * perPage,
    page * perPage
  );

  function getVisiblePages() {
    if (totalPages <= 7) {
      return Array.from(
        { length: totalPages },
        (_, i) => i + 1
      );
    }

    const pages = [1];

    let start = Math.max(2, page - 2);
    let end = Math.min(totalPages - 1, page + 2);

    if (page <= 4) {
      start = 2;
      end = 5;
    }

    if (page >= totalPages - 3) {
      start = totalPages - 4;
      end = totalPages - 1;
    }

    if (start > 2) {
      pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  }

  function exportToExcel() {
    if (list.length === 0) {
      alert("다운로드할 민원 데이터가 없습니다.");
      return;
    }

    const now = new Date();
    const printTime = now.toLocaleString("ko-KR");

    const titleRow = [
      `📋 민원 접수 관리 목록 (다운로드 일시: ${printTime})`,
    ];

    const statsRow = [
      `총 ${list.length}건 (미처리 ${pendingCount}건 / 진행중 ${progressCount}건 / 처리완료 ${completeCount}건)`,
    ];

    const headers = [
      "관리번호",
      "접수일시",
      "신고자",
      "민원내용",
      "접수자",
      "처리내용",
      "처리상태",
    ];

    const dataRows = list.map((item) => [
      item.number,
      item.fullDate || item.date,
      item.name,
      item.content,
      item.receiver || "-",
      item.process || "-",
      item.status,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([
      titleRow,
      statsRow,
      [],
      headers,
      ...dataRows,
    ]);

    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 22 },
      { wch: 12 },
      { wch: 45 },
      { wch: 12 },
      { wch: 45 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "민원접수목록"
    );

    XLSX.writeFile(
      workbook,
      `민원접수목록_백업_${getTodayString()}.xlsx`
    );
  }

  function importFromExcel(e) {
    if (!isAdmin) {
      alert("읽기 전용 계정에서는 백업을 복원할 수 없습니다.");
      return;
    }

    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;

        const workbook = XLSX.read(bstr, {
          type: "binary",
        });

        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];

        const rawArray = XLSX.utils.sheet_to_json(ws, {
          header: 1,
        });

        let headerRowIndex = rawArray.findIndex(
          (row) =>
            Array.isArray(row) &&
            row.includes("관리번호")
        );

        if (headerRowIndex === -1) {
          alert("올바른 민원 백업 파일이 아닙니다.");
          return;
        }

        const rawData = XLSX.utils.sheet_to_json(ws, {
          range: headerRowIndex,
        });

        const importedList = rawData
          .filter((row) => row["관리번호"])
          .map((row, index) => {
            const fullDate = String(
              row["접수일시"] || ""
            );

            return {
              id: Date.now() + index,
              number: String(
                row["관리번호"] || ""
              ),
              date: fullDate,
              full_date: fullDate,
              name: String(
                row["신고자"] || ""
              ),
              content: String(
                row["민원내용"] || ""
              ),
              receiver:
                row["접수자"] === "-"
                  ? ""
                  : String(row["접수자"] || ""),
              process:
                row["처리내용"] === "-"
                  ? ""
                  : String(row["처리내용"] || ""),
              status: String(
                row["처리상태"] || "미처리"
              ),
            };
          });

        if (importedList.length === 0) {
          alert("엑셀 파일에 민원 데이터가 없습니다.");
          return;
        }

        const ok = window.confirm(
          `백업 데이터 ${importedList.length}건을 복원합니다.\n\n` +
            `현재 서버의 민원 데이터는 삭제되고\n` +
            `백업 파일 내용으로 교체됩니다.\n\n` +
            `계속하시겠습니까?`
        );

        if (!ok) return;

        const { error: deleteError } = await supabase
          .from("complaints")
          .delete()
          .gte("id", 0);

        if (deleteError) {
          throw deleteError;
        }

        const chunkSize = 200;

        for (
          let i = 0;
          i < importedList.length;
          i += chunkSize
        ) {
          const chunk = importedList.slice(
            i,
            i + chunkSize
          );

          const { error: insertError } = await supabase
            .from("complaints")
            .insert(chunk);

          if (insertError) {
            throw insertError;
          }
        }

        await loadComplaints();

        setPage(1);
        setSelected(null);

        alert(
          `${importedList.length}건의 민원 데이터가 복원되었습니다.`
        );
      } catch (err) {
        console.error(err);

        alert(
          `백업 복원 중 오류가 발생했습니다.\n${
            err?.message || err
          }`
        );
      }
    };

    reader.readAsBinaryString(file);

    e.target.value = "";
  }

  if (authLoading) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.loginBox}>
          <h2 style={styles.loginTitle}>
            📋 민원접수관리 시스템
          </h2>

          <p style={styles.loginDescription}>
            로그인 상태 확인 중...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.centerPage}>
        <form
          style={styles.loginBox}
          onSubmit={handleLogin}
        >
          <div style={styles.loginIcon}>📋</div>

          <h2 style={styles.loginTitle}>
            민원접수관리 시스템
          </h2>

          <p style={styles.loginDescription}>
            등록된 사용자만 접속할 수 있습니다.
          </p>

          <label style={styles.label}>
            아이디
          </label>

          <input
            style={styles.loginInput}
            placeholder="아이디"
            value={loginId}
            onChange={(e) =>
              setLoginId(e.target.value)
            }
            autoComplete="username"
          />

          <label style={styles.label}>
            비밀번호
          </label>

          <input
            type="password"
            style={styles.loginInput}
            placeholder="비밀번호"
            value={loginPassword}
            onChange={(e) =>
              setLoginPassword(e.target.value)
            }
            autoComplete="current-password"
          />

          <button
            type="submit"
            style={styles.loginButton}
            disabled={loginLoading}
          >
            {loginLoading
              ? "로그인 중..."
              : "로그인"}
          </button>
        </form>
      </div>
    );
  }

  if (roleLoading || !userRole) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.loginBox}>
          <h2 style={styles.loginTitle}>
            📋 민원접수관리 시스템
          </h2>

          <p style={styles.loginDescription}>
            사용자 권한 확인 중...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div />

        <h1 style={styles.title}>
          📋 민원접수관리 시스템
        </h1>

        <div style={styles.userArea}>
          <div style={styles.userText}>
            <strong>
              {displayName ||
                (isAdmin
                  ? "대표 계정"
                  : "읽기 전용")}
            </strong>

            <span
              style={{
                ...styles.roleBadge,
                backgroundColor: isAdmin
                  ? "#dbeafe"
                  : "#f1f5f9",
                color: isAdmin
                  ? "#1d4ed8"
                  : "#64748b",
              }}
            >
              {isAdmin ? "관리자" : "읽기 전용"}
            </span>
          </div>

          <button
            style={styles.logoutButton}
            onClick={handleLogout}
          >
            로그아웃
          </button>
        </div>
      </div>

      <div style={styles.stats}>
        <StatCard
          title="오늘 접수"
          value={todayCount}
        />

        <StatCard
          title="미처리"
          value={pendingCount}
          color="#e11d48"
        />

        <StatCard
          title="진행중"
          value={progressCount}
          color="#d97706"
        />

        <StatCard
          title="처리완료"
          value={completeCount}
          color="#16a34a"
        />
      </div>

      <div
        style={{
          ...styles.layout,
          gridTemplateColumns: isAdmin
            ? "210px minmax(0, 1fr) 240px"
            : "minmax(0, 1fr) 280px",
        }}
      >
        {isAdmin && (
          <div style={styles.box}>
            <h3 style={styles.boxTitle}>
              ✍️ 신규 민원 등록
            </h3>

            <label style={styles.label}>
              신고자
            </label>

            <input
              style={styles.input}
              placeholder="신고자 이름"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
            />

            <label style={styles.label}>
              민원내용
            </label>

            <textarea
              style={styles.textarea}
              placeholder="상세 내용을 입력하세요"
              value={content}
              onChange={(e) =>
                setContent(e.target.value)
              }
            />

            <label style={styles.label}>
              접수자
            </label>

            <input
              style={styles.input}
              placeholder="접수 담당자"
              value={receiver}
              onChange={(e) =>
                setReceiver(e.target.value)
              }
            />

            <button
              style={styles.buttonPrimary}
              onClick={saveData}
            >
              민원 저장
            </button>
          </div>
        )}

        <div style={styles.listBox}>
          <div style={styles.listHeader}>
            <h3 style={styles.boxTitle}>
              📑 민원 목록
            </h3>

            <div style={styles.filterGroup}>
              {isAdmin && (
                <>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    ref={fileInputRef}
                    style={{
                      display: "none",
                    }}
                    onChange={importFromExcel}
                  />

                  <button
                    style={styles.buttonImport}
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    📂 백업 불러오기
                  </button>
                </>
              )}

              <button
                style={styles.buttonExcel}
                onClick={exportToExcel}
              >
                📊 엑셀 다운로드
              </button>

              <button
                style={styles.refreshButton}
                onClick={loadComplaints}
              >
                ↻ 새로고침
              </button>

              <select
                style={styles.selectFilter}
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(
                    e.target.value
                  );

                  setPage(1);
                }}
              >
                <option value="전체">
                  전체 상태
                </option>

                <option value="미처리">
                  미처리
                </option>

                <option value="진행중">
                  진행중
                </option>

                <option value="처리완료">
                  처리완료
                </option>
              </select>

              <input
                style={styles.searchInput}
                placeholder="검색어 입력"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(
                    e.target.value
                  );

                  setPage(1);
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <colgroup>
                <col style={{ width: "85px" }} />
                <col style={{ width: "90px" }} />
                <col style={{ width: "60px" }} />
                <col style={{ width: "auto" }} />
                <col style={{ width: "65px" }} />

                {isAdmin && (
                  <col style={{ width: "45px" }} />
                )}
              </colgroup>

              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>
                    관리번호
                  </th>

                  <th style={styles.th}>
                    접수일시
                  </th>

                  <th style={styles.th}>
                    신고자
                  </th>

                  <th style={styles.th}>
                    민원내용
                  </th>

                  <th style={styles.th}>
                    상태
                  </th>

                  {isAdmin && (
                    <th style={styles.th}>
                      관리
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {currentList.length ? (
                  currentList.map((item) => (
                    <tr
                      key={item.id}
                      style={styles.row}
                      onClick={() =>
                        selectItem(item)
                      }
                    >
                      <td style={styles.tdNoWrap}>
                        {item.number}
                      </td>

                      <td style={styles.tdNoWrap}>
                        {item.date}
                      </td>

                      <td style={styles.tdNoWrap}>
                        {item.name}
                      </td>

                      <td style={styles.contentTd}>
                        {item.content}
                      </td>

                      <td style={styles.tdNoWrap}>
                        <span
                          style={getStatusBadgeStyle(
                            item.status
                          )}
                        >
                          {item.status}
                        </span>
                      </td>

                      {isAdmin && (
                        <td style={styles.tdNoWrap}>
                          <button
                            style={
                              styles.buttonDelete
                            }
                            onClick={(e) => {
                              e.stopPropagation();

                              deleteData(
                                item.number
                              );
                            }}
                          >
                            삭제
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      style={styles.emptyTd}
                    >
                      {dataLoading
                        ? "데이터를 불러오는 중입니다."
                        : "등록된 민원이 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.pagination}>
            <button
              style={styles.pageButton}
              disabled={page === 1}
              onClick={() =>
                setPage((p) =>
                  Math.max(1, p - 1)
                )
              }
            >
              ‹
            </button>

            {getVisiblePages().map(
              (num, index) =>
                num === "..." ? (
                  <span
                    key={index}
                    style={
                      styles.pageEllipsis
                    }
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={num}
                    style={{
                      ...styles.pageButton,
                      background:
                        page === num
                          ? "#2563eb"
                          : "#f1f5f9",
                      color:
                        page === num
                          ? "white"
                          : "#333",
                    }}
                    onClick={() =>
                      setPage(num)
                    }
                  >
                    {num}
                  </button>
                )
            )}

            <button
              style={styles.pageButton}
              disabled={
                page === totalPages
              }
              onClick={() =>
                setPage((p) =>
                  Math.min(
                    totalPages,
                    p + 1
                  )
                )
              }
            >
              ›
            </button>
          </div>
        </div>

        <div style={styles.box}>
          <h3 style={styles.boxTitle}>
            {isAdmin
              ? "⚙️ 민원 처리"
              : "🔎 민원 상세"}
          </h3>

          {selected ? (
            <>
              <div style={styles.selectedDetail}>
                <Detail
                  label="관리번호"
                  value={selected.number}
                />

                <Detail
                  label="접수일시"
                  value={
                    selected.fullDate ||
                    selected.date
                  }
                />

                <Detail
                  label="신고자"
                  value={selected.name}
                />

                <Detail
                  label="민원내용"
                  value={selected.content}
                />

                <Detail
                  label="접수자"
                  value={
                    selected.receiver || "-"
                  }
                />

                {isViewer && (
                  <>
                    <Detail
                      label="처리내용"
                      value={
                        selected.process ||
                        "-"
                      }
                    />

                    <Detail
                      label="처리상태"
                      value={selected.status}
                    />
                  </>
                )}
              </div>

              {isAdmin && (
                <>
                  <label style={styles.label}>
                    처리내용
                  </label>

                  <div
                    style={
                      styles.processOptions
                    }
                  >
                    {PROCESS_OPTIONS.map(
                      (option) => (
                        <label
                          key={option}
                          style={
                            styles.processOption
                          }
                        >
                          <input
                            type="checkbox"
                            checked={quickProcess.includes(
                              option
                            )}
                            onChange={() =>
                              toggleQuickProcess(
                                option
                              )
                            }
                          />

                          {option}
                        </label>
                      )
                    )}
                  </div>

                  <label style={styles.label}>
                    기타 / 추가 내용
                  </label>

                  <textarea
                    style={styles.textarea}
                    value={extraProcess}
                    onChange={(e) =>
                      setExtraProcess(
                        e.target.value
                      )
                    }
                  />

                  <label style={styles.label}>
                    처리상태
                  </label>

                  <select
                    style={styles.selectInput}
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value
                      )
                    }
                  >
                    <option value="미처리">
                      미처리
                    </option>

                    <option value="진행중">
                      진행중
                    </option>

                    <option value="처리완료">
                      처리완료
                    </option>
                  </select>

                  <button
                    style={
                      styles.buttonSuccess
                    }
                    onClick={updateData}
                  >
                    수정 저장
                  </button>
                </>
              )}
            </>
          ) : (
            <div style={styles.noSelection}>
              목록에서 민원을 선택해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>
        {label}
      </span>

      <span style={styles.detailValue}>
        {value}
      </span>
    </div>
  );
}

function StatCard({
  title,
  value,
  color = "#64748b",
}) {
  return (
    <div style={styles.card}>
      <p
        style={{
          ...styles.cardLabel,
          color,
        }}
      >
        {title}
      </p>

      <h2 style={styles.cardValue}>
        {value}건
      </h2>
    </div>
  );
}

function getStatusBadgeStyle(status) {
  const base = {
    padding: "3px 6px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: "600",
    whiteSpace: "nowrap",
  };

  if (status === "처리완료") {
    return {
      ...base,
      background: "#dcfce7",
      color: "#16a34a",
    };
  }

  if (status === "진행중") {
    return {
      ...base,
      background: "#fef3c7",
      color: "#d97706",
    };
  }

  return {
    ...base,
    background: "#ffe4e6",
    color: "#e11d48",
  };
}

const styles = {
  centerPage: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f1f5f9",
    fontFamily: "Arial, sans-serif",
  },

  loginBox: {
    width: "360px",
    background: "white",
    padding: "32px",
    borderRadius: "14px",
    boxShadow: "0 8px 30px rgba(0,0,0,.08)",
  },

  loginIcon: {
    fontSize: "36px",
    textAlign: "center",
  },

  loginTitle: {
    textAlign: "center",
    margin: "10px 0",
  },

  loginDescription: {
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
    marginBottom: "24px",
  },

  loginInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px",
    marginBottom: "14px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
  },

  loginButton: {
    width: "100%",
    padding: "11px",
    background: "#2563eb",
    color: "white",
    border: 0,
    borderRadius: "7px",
    fontWeight: "bold",
    cursor: "pointer",
  },

  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "12px 8px",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },

  topBar: {
    display: "grid",
    gridTemplateColumns: "200px 1fr 200px",
    alignItems: "center",
    marginBottom: "12px",
  },

  title: {
    textAlign: "center",
    margin: 0,
    fontSize: "22px",
  },

  userArea: {
    justifySelf: "end",
    display: "flex",
    gap: "7px",
    alignItems: "center",
    whiteSpace: "nowrap",
  },

  userText: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },

  roleBadge: {
    padding: "2px 6px",
    borderRadius: "7px",
    fontSize: "9px",
    lineHeight: "16px",
    whiteSpace: "nowrap",
  },

  logoutButton: {
    background: "white",
    color: "#64748b",
    border: "1px solid #cbd5e1",
    padding: "4px 8px",
    height: "26px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "10px",
    whiteSpace: "nowrap",
  },

  stats: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, 1fr)",
    gap: "10px",
    marginBottom: "12px",
  },

  card: {
    background: "white",
    padding: "10px",
    borderRadius: "10px",
    textAlign: "center",
  },

  cardLabel: {
    margin: 0,
    fontSize: "12px",
    fontWeight: "bold",
  },

  cardValue: {
    margin: "5px 0 0",
    fontSize: "19px",
  },

  layout: {
    display: "grid",
    gap: "10px",
  },

  box: {
    background: "white",
    padding: "14px",
    borderRadius: "12px",
  },

  listBox: {
    background: "white",
    padding: "14px",
    borderRadius: "12px",
    minWidth: 0,
  },

  boxTitle: {
    margin: "0 0 12px",
    fontSize: "17px",
  },

  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    margin: "8px 0 6px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px",
    marginBottom: "8px",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "80px",
    padding: "8px",
    marginBottom: "8px",
  },

  selectInput: {
    width: "100%",
    padding: "8px",
    marginBottom: "12px",
  },

  buttonPrimary: {
    width: "100%",
    padding: "9px",
    background: "#2563eb",
    color: "white",
    border: 0,
    borderRadius: "6px",
    cursor: "pointer",
  },

  buttonSuccess: {
    width: "100%",
    padding: "9px",
    background: "#16a34a",
    color: "white",
    border: 0,
    borderRadius: "6px",
    cursor: "pointer",
  },

  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    flexWrap: "wrap",
  },

  filterGroup: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },

  buttonImport: {
    background: "#475569",
    color: "white",
    border: 0,
    borderRadius: "6px",
    padding: "5px 8px",
  },

  buttonExcel: {
    background: "#107c41",
    color: "white",
    border: 0,
    borderRadius: "6px",
    padding: "5px 8px",
  },

  refreshButton: {
    border: 0,
    borderRadius: "6px",
    padding: "5px 8px",
  },

  selectFilter: {
    padding: "5px",
  },

  searchInput: {
    padding: "5px",
  },

  table: {
    width: "100%",
    tableLayout: "fixed",
    borderCollapse: "collapse",
    fontSize: "12px",
    textAlign: "left",
  },

  tableHeadRow: {
    borderBottom: "2px solid #e2e8f0",
  },

  th: {
    padding: "8px 5px",
    textAlign: "left",
    whiteSpace: "nowrap",
  },

  row: {
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer",
  },

  tdNoWrap: {
    padding: "8px 5px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "left",
  },

  contentTd: {
    padding: "8px 5px",
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  buttonDelete: {
    border: "1px solid #cbd5e1",
    background: "white",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "11px",
    padding: "2px 5px",
  },

  emptyTd: {
    padding: "40px",
    textAlign: "left",
    color: "#94a3b8",
  },

  pagination: {
    display: "flex",
    justifyContent: "center",
    gap: "4px",
    marginTop: "15px",
  },

  pageButton: {
    border: 0,
    borderRadius: "4px",
    padding: "5px 8px",
    cursor: "pointer",
  },

  pageEllipsis: {
    padding: "5px",
  },

  processOptions: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "10px",
  },

  processOption: {
    padding: "7px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    fontSize: "12px",
  },

  selectedDetail: {
    background: "#f8fafc",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "12px",
  },

  detailRow: {
    display: "flex",
    marginBottom: "7px",
    fontSize: "12px",
  },

  detailLabel: {
    width: "65px",
    color: "#64748b",
    fontWeight: "bold",
    flexShrink: 0,
  },

  detailValue: {
    flex: 1,
    wordBreak: "break-word",
  },

  noSelection: {
    textAlign: "left",
    color: "#94a3b8",
    marginTop: "50px",
  },
};

export default App;