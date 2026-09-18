import { useState, useEffect, useRef } from "react";
import XLSX from "xlsx-js-style";

const PROCESS_OPTIONS = [
  "담당 부서(파트) 인계",
  "공조기 가동 / 중지",
  "공조기 설정 변경",
  "현장 조치 완료",
];

function App() {
  // LocalStorage initial load
  const [list, setList] = useState(() => {
    const saved = localStorage.getItem("minwon_list");
    return saved ? JSON.parse(saved) : [];
  });

  // 입력 폼 상태
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [receiver, setReceiver] = useState("");

  // 선택된 항목 및 처리 폼
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("미처리");
  const [quickProcess, setQuickProcess] = useState([]);
  const [extraProcess, setExtraProcess] = useState("");

  // 검색 및 필터 상태
  const [filterStatus, setFilterStatus] = useState("전체");
  const [searchTerm, setSearchTerm] = useState("");

  // 페이징
  const [page, setPage] = useState(1);
  const perPage = 10;

  // 파일 업로드 Input 참조
  const fileInputRef = useRef(null);

  // 데이터 변경 시 LocalStorage 저장
  useEffect(() => {
    localStorage.setItem("minwon_list", JSON.stringify(list));
  }, [list]);

  // 목록용 슬림 날짜 포맷
  function getShortDate(dateObj = new Date()) {
    const MM = String(dateObj.getMonth() + 1).padStart(2, "0");
    const DD = String(dateObj.getDate()).padStart(2, "0");
    const hh = String(dateObj.getHours()).padStart(2, "0");
    const mm = String(dateObj.getMinutes()).padStart(2, "0");

    return `${MM}-${DD} ${hh}:${mm}`;
  }

  // 오늘 날짜 YYYY-MM-DD
  function getTodayString() {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, "0");
    const DD = String(now.getDate()).padStart(2, "0");

    return `${YYYY}-${MM}-${DD}`;
  }

  // 신규 민원 저장
  function saveData() {
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

    const data = {
      id: Date.now(),
      number,
      date: getShortDate(now),
      fullDate: now.toLocaleString("ko-KR"),
      name: name.trim(),
      content: content.trim(),
      receiver: receiver.trim(),
      process: "",
      status: "미처리",
    };

    const newList = [data, ...list];

    setList(newList);

    setName("");
    setContent("");
    setReceiver("");

    setPage(1);
  }

  // 민원 선택
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

  // 처리 체크박스 선택
  function toggleQuickProcess(value) {
    setQuickProcess((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  }

  // 처리 결과 저장
  function updateData() {
    if (!selected) return;

    const finalProcess = [
      ...quickProcess,
      extraProcess.trim(),
    ]
      .filter(Boolean)
      .join(" · ");

    const newList = list.map((item) => {
      if (item.number === selected.number) {
        return {
          ...item,
          process: finalProcess,
          status,
        };
      }

      return item;
    });

    setList(newList);

    setSelected(null);
    setQuickProcess([]);
    setExtraProcess("");

    alert("처리 내용이 저장되었습니다.");
  }

  // 삭제
  function deleteData(number) {
    if (window.confirm("정말 삭제하시겠습니까?")) {
      const newList = list.filter(
        (item) => item.number !== number
      );

      setList(newList);

      if (
        selected &&
        selected.number === number
      ) {
        setSelected(null);
      }

      const maxPage =
        Math.ceil(newList.length / perPage);

      if (page > maxPage) {
        setPage(maxPage || 1);
      }
    }
  }

  // 통계
  const todayPrefix = getTodayString();

  const todayCount = list.filter(
    (item) =>
      item.fullDate?.includes(todayPrefix) ||
      item.date?.startsWith(todayPrefix.slice(5))
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

  // 엑셀 다운로드
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

    const emptyRow = [];

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

    const worksheet =
      XLSX.utils.aoa_to_sheet([
        titleRow,
        statsRow,
        emptyRow,
        headers,
        ...dataRows,
      ]);

    const thinBorder = {
      top: {
        style: "thin",
        color: { rgb: "E2E8F0" },
      },

      bottom: {
        style: "thin",
        color: { rgb: "E2E8F0" },
      },

      left: {
        style: "thin",
        color: { rgb: "E2E8F0" },
      },

      right: {
        style: "thin",
        color: { rgb: "E2E8F0" },
      },
    };

    const range =
      XLSX.utils.decode_range(
        worksheet["!ref"]
      );

    for (
      let R = range.s.r;
      R <= range.e.r;
      ++R
    ) {
      for (
        let C = range.s.c;
        C <= range.e.c;
        ++C
      ) {
        const cellAddress =
          XLSX.utils.encode_cell({
            r: R,
            c: C,
          });

        if (!worksheet[cellAddress])
          continue;

        if (R === 0) {
          worksheet[cellAddress].s = {
            font: {
              name: "맑은 고딕",
              sz: 13,
              bold: true,
              color: {
                rgb: "0F172A",
              },
            },
          };
        } else if (R === 1) {
          worksheet[cellAddress].s = {
            font: {
              name: "맑은 고딕",
              sz: 10,
              bold: true,
              color: {
                rgb: "475569",
              },
            },
          };
        } else if (R === 3) {
          worksheet[cellAddress].s = {
            font: {
              name: "맑은 고딕",
              sz: 11,
              bold: true,
              color: {
                rgb: "FFFFFF",
              },
            },

            fill: {
              fgColor: {
                rgb: "1E293B",
              },
            },

            alignment: {
              horizontal: "center",
              vertical: "center",
            },

            border: thinBorder,
          };
        } else if (R >= 4) {
          const isEven =
            R % 2 === 0;

          const bgBgColor =
            isEven
              ? "F8FAFC"
              : "FFFFFF";

          const isLeftAlign =
            C === 3 || C === 5;

          let fontColor =
            "1E293B";

          let customBg =
            bgBgColor;

          if (C === 6) {
            const statusVal =
              worksheet[cellAddress].v;

            if (
              statusVal ===
              "처리완료"
            ) {
              customBg =
                "DCFCE7";

              fontColor =
                "15803D";
            } else if (
              statusVal ===
              "진행중"
            ) {
              customBg =
                "FEF3C7";

              fontColor =
                "B45309";
            } else {
              customBg =
                "FFE4E6";

              fontColor =
                "BE123C";
            }
          }

          worksheet[cellAddress].s = {
            font: {
              name: "맑은 고딕",
              sz: 10,
              color: {
                rgb: fontColor,
              },
              bold: C === 6,
            },

            fill: {
              fgColor: {
                rgb: customBg,
              },
            },

            alignment: {
              horizontal:
                isLeftAlign
                  ? "left"
                  : "center",

              vertical:
                "center",

              wrapText:
                true,
            },

            border:
              thinBorder,
          };
        }
      }
    }

    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 22 },
      { wch: 12 },
      { wch: 45 },
      { wch: 12 },
      { wch: 45 },
      { wch: 12 },
    ];

    worksheet["!rows"] = [
      { hpt: 24 },
      { hpt: 18 },
      { hpt: 10 },
      { hpt: 28 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "민원접수목록"
    );

    const today =
      getTodayString();

    XLSX.writeFile(
      workbook,
      `민원접수목록_백업_${today}.xlsx`
    );
  }

  // 엑셀 백업 불러오기
  function importFromExcel(e) {
    const file =
      e.target.files[0];

    if (!file)
      return;

    const reader =
      new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr =
          evt.target.result;

        const workbook =
          XLSX.read(
            bstr,
            {
              type: "binary",
            }
          );

        const wsname =
          workbook.SheetNames[0];

        const ws =
          workbook.Sheets[wsname];

        const rawArray =
          XLSX.utils.sheet_to_json(
            ws,
            {
              header: 1,
            }
          );

        let headerRowIndex =
          rawArray.findIndex(
            (row) =>
              Array.isArray(row) &&
              row.includes(
                "관리번호"
              )
          );

        if (
          headerRowIndex === -1
        ) {
          headerRowIndex = 0;
        }

        const rawData =
          XLSX.utils.sheet_to_json(
            ws,
            {
              range:
                headerRowIndex,
            }
          );

        if (
          rawData.length === 0
        ) {
          alert(
            "엑셀 파일에 데이터가 없습니다."
          );

          return;
        }

        const importedList =
          rawData.map(
            (
              row,
              index
            ) => ({
              id:
                Date.now() +
                index,

              number:
                String(
                  row[
                    "관리번호"
                  ] || ""
                ),

              date:
                String(
                  row[
                    "접수일시"
                  ] || ""
                ).slice(
                  5,
                  16
                ) ||
                getShortDate(),

              fullDate:
                String(
                  row[
                    "접수일시"
                  ] || ""
                ),

              name:
                String(
                  row[
                    "신고자"
                  ] || ""
                ),

              content:
                String(
                  row[
                    "민원내용"
                  ] || ""
                ),

              receiver:
                row[
                  "접수자"
                ] === "-"
                  ? ""
                  : String(
                      row[
                        "접수자"
                      ] || ""
                    ),

              process:
                row[
                  "처리내용"
                ] === "-"
                  ? ""
                  : String(
                      row[
                        "처리내용"
                      ] || ""
                    ),

              status:
                String(
                  row[
                    "처리상태"
                  ] ||
                    "미처리"
                ),
            })
          );

        if (
          window.confirm(
            `${importedList.length}건의 백업 데이터를 불러오시겠습니까?`
          )
        ) {
          setList(
            importedList
          );

          setPage(1);

          alert(
            "데이터가 성공적으로 복원되었습니다!"
          );
        }
      } catch (err) {
        console.error(err);

        alert(
          "엑셀 파일을 읽는 중 오류가 발생했습니다. 올바른 백업 파일인지 확인해주세요."
        );
      }
    };

    reader.readAsBinaryString(
      file
    );

    e.target.value =
      "";
  }

  // 검색 및 필터
  const filteredList =
    list.filter((item) => {
      const matchesStatus =
        filterStatus ===
          "전체" ||
        item.status ===
          filterStatus;

      const keyword =
        searchTerm.toLowerCase();

      const matchesSearch =
        (item.name || "")
          .toLowerCase()
          .includes(keyword) ||
        (item.content || "")
          .toLowerCase()
          .includes(keyword) ||
        (item.number || "")
          .toLowerCase()
          .includes(keyword) ||
        (item.process || "")
          .toLowerCase()
          .includes(keyword);

      return (
        matchesStatus &&
        matchesSearch
      );
    });

  // 페이지 계산
  const totalPages =
    Math.ceil(
      filteredList.length /
        perPage
    ) || 1;

  const currentList =
    filteredList.slice(
      (page - 1) *
        perPage,
      page * perPage
    );

  // 페이지 번호 축약
  function getVisiblePages() {
    if (
      totalPages <= 7
    ) {
      return Array.from(
        {
          length:
            totalPages,
        },
        (_, i) =>
          i + 1
      );
    }

    const pages = [1];

    let start =
      Math.max(
        2,
        page - 2
      );

    let end =
      Math.min(
        totalPages - 1,
        page + 2
      );

    if (page <= 4) {
      start = 2;
      end = 5;
    }

    if (
      page >=
      totalPages - 3
    ) {
      start =
        totalPages - 4;

      end =
        totalPages - 1;
    }

    if (start > 2) {
      pages.push("...");
    }

    for (
      let i = start;
      i <= end;
      i++
    ) {
      pages.push(i);
    }

    if (
      end <
      totalPages - 1
    ) {
      pages.push("...");
    }

    pages.push(
      totalPages
    );

    return pages;
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>
        📋 민원접수관리 시스템
      </h1>

      {/* 통계 카드 */}
      <div style={styles.stats}>
        <div style={styles.card}>
          <p style={styles.cardLabel}>
            오늘 접수
          </p>

          <h2 style={styles.cardValue}>
            {todayCount}건
          </h2>
        </div>

        <div style={styles.card}>
          <p
            style={{
              ...styles.cardLabel,
              color: "#e11d48",
            }}
          >
            미처리
          </p>

          <h2 style={styles.cardValue}>
            {pendingCount}건
          </h2>
        </div>

        <div style={styles.card}>
          <p
            style={{
              ...styles.cardLabel,
              color: "#d97706",
            }}
          >
            진행중
          </p>

          <h2 style={styles.cardValue}>
            {progressCount}건
          </h2>
        </div>

        <div style={styles.card}>
          <p
            style={{
              ...styles.cardLabel,
              color: "#16a34a",
            }}
          >
            처리완료
          </p>

          <h2 style={styles.cardValue}>
            {completeCount}건
          </h2>
        </div>
      </div>

      <div style={styles.layout}>
        {/* 신규 등록 */}
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
              setName(
                e.target.value
              )
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
              setContent(
                e.target.value
              )
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
              setReceiver(
                e.target.value
              )
            }
          />

          <button
            style={styles.buttonPrimary}
            onClick={saveData}
          >
            민원 저장
          </button>
        </div>

        {/* 목록 */}
        <div style={styles.listBox}>
          <div style={styles.listHeader}>
            <h3 style={styles.boxTitle}>
              📑 민원 목록
            </h3>

            <div style={styles.filterGroup}>
              <input
                type="file"
                accept=".xlsx, .xls"
                ref={fileInputRef}
                style={{
                  display: "none",
                }}
                onChange={
                  importFromExcel
                }
              />

              <button
                style={
                  styles.buttonImport
                }
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                📂 백업 불러오기
              </button>

              <button
                style={
                  styles.buttonExcel
                }
                onClick={
                  exportToExcel
                }
              >
                📊 엑셀 다운로드
              </button>

              <select
                style={
                  styles.selectFilter
                }
                value={
                  filterStatus
                }
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
                style={
                  styles.searchInput
                }
                placeholder="검색어 입력"
                value={
                  searchTerm
                }
                onChange={(e) => {
                  setSearchTerm(
                    e.target.value
                  );

                  setPage(1);
                }}
              />
            </div>
          </div>

          <div
            style={{
              overflowX:
                "auto",
            }}
          >
            <table
              style={styles.table}
            >
              <colgroup>
                <col
                  style={{
                    width:
                      "105px",
                  }}
                />

                <col
                  style={{
                    width:
                      "90px",
                  }}
                />

                <col
                  style={{
                    width:
                      "70px",
                  }}
                />

                <col
                  style={{
                    width:
                      "auto",
                  }}
                />

                <col
                  style={{
                    width:
                      "65px",
                  }}
                />

                <col
                  style={{
                    width:
                      "50px",
                  }}
                />
              </colgroup>

              <thead>
                <tr
                  style={
                    styles.tableHeadRow
                  }
                >
                  <th
                    style={
                      styles.th
                    }
                  >
                    관리번호
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    접수일시
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    신고자
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    민원내용
                  </th>

                  <th
                    style={{
                      ...styles.th,
                      textAlign:
                        "center",
                    }}
                  >
                    상태
                  </th>

                  <th
                    style={{
                      ...styles.th,
                      textAlign:
                        "center",
                    }}
                  >
                    관리
                  </th>
                </tr>
              </thead>

              <tbody>
                {currentList.length >
                0 ? (
                  currentList.map(
                    (item) => {
                      const isSelected =
                        selected &&
                        selected.number ===
                          item.number;

                      return (
                        <tr
                          key={
                            item.number
                          }
                          style={{
                            ...styles.row,

                            backgroundColor:
                              isSelected
                                ? "#e0f2fe"
                                : "transparent",
                          }}
                          onClick={() =>
                            selectItem(
                              item
                            )
                          }
                        >
                          <td
                            style={
                              styles.tdNoWrap
                            }
                          >
                            {
                              item.number
                            }
                          </td>

                          <td
                            style={{
                              ...styles.tdNoWrap,
                              ...styles.dateTd,
                            }}
                          >
                            {
                              item.date
                            }
                          </td>

                          <td
                            style={
                              styles.tdNoWrap
                            }
                          >
                            {
                              item.name
                            }
                          </td>

                          <td
                            style={
                              styles.contentTd
                            }
                            title={
                              item.content
                            }
                          >
                            {
                              item.content
                            }
                          </td>

                          <td
                            style={{
                              ...styles.tdNoWrap,
                              textAlign:
                                "center",
                            }}
                          >
                            <span
                              style={getStatusBadgeStyle(
                                item.status
                              )}
                            >
                              {
                                item.status
                              }
                            </span>
                          </td>

                          <td
                            style={{
                              ...styles.tdNoWrap,
                              textAlign:
                                "center",
                            }}
                          >
                            <button
                              style={
                                styles.buttonDelete
                              }
                              onClick={(
                                e
                              ) => {
                                e.stopPropagation();

                                deleteData(
                                  item.number
                                );
                              }}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      style={
                        styles.emptyTd
                      }
                    >
                      등록되거나 조건에 맞는 민원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지 */}
          <div
            style={
              styles.pagination
            }
          >
            <button
              style={{
                ...styles.pageButton,

                opacity:
                  page === 1
                    ? 0.4
                    : 1,
              }}
              disabled={
                page === 1
              }
              onClick={() =>
                setPage(
                  (prev) =>
                    Math.max(
                      1,
                      prev - 1
                    )
                )
              }
            >
              ‹
            </button>

            {getVisiblePages().map(
              (
                num,
                index
              ) =>
                num ===
                "..." ? (
                  <span
                    key={`ellipsis-${index}`}
                    style={
                      styles.pageEllipsis
                    }
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={
                      num
                    }
                    style={{
                      ...styles.pageButton,

                      backgroundColor:
                        page ===
                        num
                          ? "#2563eb"
                          : "#f1f5f9",

                      color:
                        page ===
                        num
                          ? "white"
                          : "#333",

                      fontWeight:
                        page ===
                        num
                          ? "bold"
                          : "normal",
                    }}
                    onClick={() =>
                      setPage(
                        num
                      )
                    }
                  >
                    {num}
                  </button>
                )
            )}

            <button
              style={{
                ...styles.pageButton,

                opacity:
                  page ===
                  totalPages
                    ? 0.4
                    : 1,
              }}
              disabled={
                page ===
                totalPages
              }
              onClick={() =>
                setPage(
                  (prev) =>
                    Math.min(
                      totalPages,
                      prev + 1
                    )
                )
              }
            >
              ›
            </button>
          </div>
        </div>

        {/* 민원 처리 */}
        <div style={styles.box}>
          <h3 style={styles.boxTitle}>
            ⚙️ 민원 처리
          </h3>

          {selected ? (
            <>
              <div
                style={
                  styles.selectedDetail
                }
              >
                <div
                  style={
                    styles.detailRow
                  }
                >
                  <span
                    style={
                      styles.detailLabel
                    }
                  >
                    관리번호
                  </span>

                  <span
                    style={
                      styles.detailValue
                    }
                  >
                    {
                      selected.number
                    }
                  </span>
                </div>

                <div
                  style={
                    styles.detailRow
                  }
                >
                  <span
                    style={
                      styles.detailLabel
                    }
                  >
                    접수일시
                  </span>

                  <span
                    style={
                      styles.detailValue
                    }
                  >
                    {selected.fullDate ||
                      selected.date}
                  </span>
                </div>

                <div
                  style={
                    styles.detailRow
                  }
                >
                  <span
                    style={
                      styles.detailLabel
                    }
                  >
                    신고자
                  </span>

                  <span
                    style={
                      styles.detailValue
                    }
                  >
                    {
                      selected.name
                    }
                  </span>
                </div>

                <div
                  style={
                    styles.detailRow
                  }
                >
                  <span
                    style={
                      styles.detailLabel
                    }
                  >
                    민원내용
                  </span>

                  <span
                    style={{
                      ...styles.detailValue,
                      fontWeight:
                        "500",
                    }}
                  >
                    {
                      selected.content
                    }
                  </span>
                </div>

                <div
                  style={
                    styles.detailRow
                  }
                >
                  <span
                    style={
                      styles.detailLabel
                    }
                  >
                    접수자
                  </span>

                  <span
                    style={
                      styles.detailValue
                    }
                  >
                    {selected.receiver ||
                      "-"}
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop:
                    "8px",
                }}
              >
                <label
                  style={
                    styles.label
                  }
                >
                  처리내용
                </label>

                <div
                  style={
                    styles.processOptions
                  }
                >
                  {PROCESS_OPTIONS.map(
                    (
                      option
                    ) => (
                      <label
                        key={
                          option
                        }
                        style={{
                          ...styles.processOption,

                          backgroundColor:
                            quickProcess.includes(
                              option
                            )
                              ? "#eff6ff"
                              : "#f8fafc",

                          borderColor:
                            quickProcess.includes(
                              option
                            )
                              ? "#93c5fd"
                              : "#e2e8f0",
                        }}
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

                        <span>
                          {
                            option
                          }
                        </span>
                      </label>
                    )
                  )}
                </div>

                <label
                  style={{
                    ...styles.label,
                    marginTop:
                      "12px",
                  }}
                >
                  기타 / 추가 내용
                </label>

                <textarea
                  style={
                    styles.textarea
                  }
                  placeholder="기타 조치내용 또는 상세 내용을 입력하세요"
                  value={
                    extraProcess
                  }
                  onChange={(e) =>
                    setExtraProcess(
                      e.target.value
                    )
                  }
                />

                <label
                  style={
                    styles.label
                  }
                >
                  처리상태
                </label>

                <select
                  style={
                    styles.selectInput
                  }
                  value={
                    status
                  }
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
                  onClick={
                    updateData
                  }
                >
                  수정 저장
                </button>
              </div>
            </>
          ) : (
            <div
              style={
                styles.noSelection
              }
            >
              <p>
                목록에서 민원을
                선택하면
                <br />
                상세 내용 및 처리가
                가능합니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusBadgeStyle(
  status
) {
  const base = {
    padding: "3px 6px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: "600",
    display: "inline-block",
    whiteSpace: "nowrap",
  };

  switch (status) {
    case "진행중":
      return {
        ...base,
        backgroundColor:
          "#fef3c7",
        color:
          "#d97706",
      };

    case "처리완료":
      return {
        ...base,
        backgroundColor:
          "#dcfce7",
        color:
          "#16a34a",
      };

    default:
      return {
        ...base,
        backgroundColor:
          "#ffe4e6",
        color:
          "#e11d48",
      };
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor:
      "#f8fafc",
    padding:
      "16px 12px",
    fontFamily:
      "'Pretendard', sans-serif, system-ui",
    boxSizing:
      "border-box",
  },

  title: {
    textAlign:
      "center",
    color:
      "#0f172a",
    marginBottom:
      "16px",
    fontSize:
      "24px",
  },

  stats: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(160px, 1fr))",

    gap:
      "12px",

    width:
      "100%",

    marginBottom:
      "16px",
  },

  card: {
    background:
      "white",

    padding:
      "12px",

    borderRadius:
      "10px",

    textAlign:
      "center",

    boxShadow:
      "0 1px 3px rgba(0,0,0,0.05)",
  },

  cardLabel: {
    margin:
      0,

    fontSize:
      "12px",

    color:
      "#64748b",

    fontWeight:
      "bold",
  },

  cardValue: {
    margin:
      "4px 0 0 0",

    fontSize:
      "20px",

    color:
      "#1e293b",
  },

  layout: {
    display:
      "grid",

    gridTemplateColumns:
      "250px 1fr 270px",

    gap:
      "12px",

    width:
      "100%",
  },

  box: {
    background:
      "white",

    padding:
      "16px",

    borderRadius:
      "12px",

    boxShadow:
      "0 1px 3px rgba(0,0,0,0.05)",

    display:
      "flex",

    flexDirection:
      "column",
  },

  listBox: {
    background:
      "white",

    padding:
      "16px",

    borderRadius:
      "12px",

    boxShadow:
      "0 1px 3px rgba(0,0,0,0.05)",

    minWidth:
      0,
  },

  listHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    marginBottom:
      "12px",

    flexWrap:
      "wrap",

    gap:
      "8px",
  },

  boxTitle: {
    margin:
      "0 0 12px 0",

    fontSize:
      "17px",

    color:
      "#334155",
  },

  filterGroup: {
    display:
      "flex",

    gap:
      "6px",

    alignItems:
      "center",

    flexWrap:
      "wrap",
  },

  selectFilter: {
    padding:
      "5px 8px",

    borderRadius:
      "6px",

    border:
      "1px solid #cbd5e1",

    fontSize:
      "12px",
  },

  searchInput: {
    padding:
      "5px 8px",

    borderRadius:
      "6px",

    border:
      "1px solid #cbd5e1",

    fontSize:
      "12px",

    width:
      "130px",
  },

  label: {
    fontSize:
      "12px",

    fontWeight:
      "600",

    color:
      "#475569",

    marginBottom:
      "6px",

    display:
      "block",
  },

  input: {
    width:
      "100%",

    padding:
      "8px 10px",

    marginBottom:
      "12px",

    borderRadius:
      "6px",

    border:
      "1px solid #cbd5e1",

    boxSizing:
      "border-box",
  },

  selectInput: {
    width:
      "100%",

    padding:
      "8px 10px",

    marginBottom:
      "14px",

    borderRadius:
      "6px",

    border:
      "1px solid #cbd5e1",

    boxSizing:
      "border-box",
  },

  textarea: {
    width:
      "100%",

    height:
      "80px",

    padding:
      "8px 10px",

    marginBottom:
      "12px",

    borderRadius:
      "6px",

    border:
      "1px solid #cbd5e1",

    boxSizing:
      "border-box",

    resize:
      "vertical",
  },

  buttonPrimary: {
    background:
      "#2563eb",

    color:
      "white",

    border:
      "none",

    padding:
      "9px",

    borderRadius:
      "6px",

    cursor:
      "pointer",

    fontWeight:
      "bold",
  },

  buttonSuccess: {
    background:
      "#16a34a",

    color:
      "white",

    border:
      "none",

    padding:
      "10px",

    borderRadius:
      "6px",

    cursor:
      "pointer",

    fontWeight:
      "bold",

    width:
      "100%",
  },

  buttonExcel: {
    background:
      "#107c41",

    color:
      "white",

    border:
      "none",

    padding:
      "5px 10px",

    borderRadius:
      "6px",

    cursor:
      "pointer",

    fontSize:
      "12px",

    fontWeight:
      "bold",
  },

  buttonImport: {
    background:
      "#475569",

    color:
      "white",

    border:
      "none",

    padding:
      "5px 10px",

    borderRadius:
      "6px",

    cursor:
      "pointer",

    fontSize:
      "12px",

    fontWeight:
      "bold",
  },

  buttonDelete: {
    background:
      "transparent",

    color:
      "#94a3b8",

    border:
      "1px solid #cbd5e1",

    padding:
      "2px 6px",

    borderRadius:
      "4px",

    cursor:
      "pointer",

    fontSize:
      "11px",

    whiteSpace:
      "nowrap",
  },

  table: {
    width:
      "100%",

    tableLayout:
      "fixed",

    borderCollapse:
      "collapse",

    fontSize:
      "13px",

    textAlign:
      "left",
  },

  tableHeadRow: {
    borderBottom:
      "2px solid #e2e8f0",

    color:
      "#64748b",

    height:
      "36px",
  },

  th: {
    padding:
      "6px 4px",

    whiteSpace:
      "nowrap",
  },

  row: {
    borderBottom:
      "1px solid #f1f5f9",

    cursor:
      "pointer",

    height:
      "42px",
  },

  tdNoWrap: {
    padding:
      "6px 4px",

    whiteSpace:
      "nowrap",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    fontSize:
      "12px",
  },

  contentTd: {
    padding:
      "6px 6px",

    fontSize:
      "13px",

    whiteSpace:
      "nowrap",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",
  },

  dateTd: {
    fontSize:
      "12px",

    color:
      "#64748b",
  },

  emptyTd: {
    textAlign:
      "center",

    padding:
      "40px 0",

    color:
      "#94a3b8",
  },

  pagination: {
    marginTop:
      "16px",

    display:
      "flex",

    justifyContent:
      "center",

    alignItems:
      "center",

    gap:
      "4px",

    flexWrap:
      "wrap",
  },

  pageButton: {
    border:
      "none",

    padding:
      "4px 8px",

    borderRadius:
      "4px",

    cursor:
      "pointer",

    fontSize:
      "12px",

    minWidth:
      "28px",
  },

  pageEllipsis: {
    padding:
      "4px",

    fontSize:
      "12px",

    color:
      "#94a3b8",
  },

  processOptions: {
    display:
      "flex",

    flexDirection:
      "column",

    gap:
      "6px",

    marginBottom:
      "4px",
  },

  processOption: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "7px",

    padding:
      "7px 8px",

    borderRadius:
      "6px",

    border:
      "1px solid #e2e8f0",

    fontSize:
      "12px",

    color:
      "#334155",

    cursor:
      "pointer",

    transition:
      "0.15s",
  },

  selectedDetail: {
    backgroundColor:
      "#f8fafc",

    padding:
      "12px 14px",

    borderRadius:
      "8px",

    border:
      "1px solid #e2e8f0",

    marginBottom:
      "14px",

    display:
      "flex",

    flexDirection:
      "column",

    gap:
      "8px",
  },

  detailRow: {
    display:
      "flex",

    alignItems:
      "flex-start",

    fontSize:
      "12px",

    lineHeight:
      "1.5",
  },

  detailLabel: {
    width:
      "55px",

    color:
      "#64748b",

    fontWeight:
      "600",

    flexShrink:
      0,
  },

  detailValue: {
    color:
      "#1e293b",

    flex:
      1,

    textAlign:
      "left",

    wordBreak:
      "break-all",
  },

  noSelection: {
    textAlign:
      "center",

    color:
      "#94a3b8",

    marginTop:
      "50px",

    fontSize:
      "13px",
  },
};

export default App;