//@ts-check
//'nanj_grid_input'classがついているseesaaのtableに機能追加
{
    /**
     * @readonly
     * @enum {number}
     */
    const ColumnType = {
        Text: 1,
        Prompt: 2,
        Image: 3,
        EditLink: 4,
    };

    //対象のテーブル このクラスがついている
    const targetTableClass = "nanj_prompt_table";

    //'追加'ボタンの識別用クラス名
    const columnPostButtonClass = "nanj_prompt_table_column_post_button";

    //プロンプトのTableのCellに付くクラス名
    const promptTableCellClass = "nanj_prompt_table_cell";

    /**
     * seesaaの記法に引っかからないようにする
     *  @param {string} value
     */
    const encodeColumnValue = (value) => {
        let encodedValue = value.replace(/[\(\[\|]/g, (match) => {
            //'[' '(' '|' はseesaaの記法とぶつかってしまうので、コードポイントでの表示
            return `&#${match.charCodeAt(0)};`;
        });
        return encodedValue;
    };

    /**
     * 編集ページをGetしてformを引っこ抜く
     * @param {string} editPagePath
     */
    const fetchFormNode = async (editPagePath) => {
        const domParser = new DOMParser();
        const textDecoder = new TextDecoder("euc-jp"); //EUC...

        const editPageBuffer = await (await fetch(editPagePath)).arrayBuffer();
        const editPageText = textDecoder.decode(editPageBuffer);
        const editPageDom = domParser.parseFromString(editPageText, "text/html");

        const formNode = /** @type {HTMLFormElement} */ (
            editPageDom.getElementById("wiki-form")
        );
        return formNode;
    };

    /**
     * 入力データをサーバーにpostしてページを更新させる
     * @param {string} editPagePath
     * @param {string[]} columnValues
     */
    const postColumnDataAsync = async (editPagePath, columnValues) => {
        const formNode = await fetchFormNode(editPagePath);
        const textAreaNode = /** @type {HTMLTextAreaElement} */ (
            formNode.querySelector("#content")
        );
        textAreaNode.value += `\n|${columnValues.join("|")}|`;

        //引っこ抜いたformを非表示でbodyに追加して即post
        formNode.style.cssText = "display: none";
        document.body.appendChild(formNode);
        formNode.submit();
    };

    /**
     * @param {ColumnType[]} columnTypes
     */
    const createNanjGridInputElement = (columnTypes) => {
        const node = document.createElement("tr");
        for (const column of columnTypes) {
            const tdElement = document.createElement("td");
            node.append(tdElement);

            let element;
            switch (column) {
                case ColumnType.Image:
                    element = document.createElement("textarea");
                    element.placeholder = "画像リンク"; //TODO アップロード・画像選択機能
                    break;
                case ColumnType.Prompt:
                case ColumnType.Text:
                    element = document.createElement("textarea");
                    break;
                case ColumnType.EditLink:
                    element = document.createElement("button");
                    element.classList.add(columnPostButtonClass);
                    element.innerText = "Add";
                    break;
                default:
                    throw "範囲外";
            }
            tdElement.append(element);
        }

        return node;
    };

    /**
     * カラムのタイプを取得
     * @param {HTMLTableSectionElement} headElement
     */
    const getColumnTypes = (headElement) => {
        if (headElement.length === 0) {
            return undefined;
        }

        /** @type {ColumnType[]} */
        const columns = [];
        for (const node of headElement.rows[0].cells) {
            if (node.textContent?.includes("プロンプト")) {
                columns.push(ColumnType.Prompt);
                continue;
            } else if (node.textContent?.includes("サンプル")) {
                columns.push(ColumnType.Image);
                continue;
            } else if (node.classList.contains("table_edit_link")) {
                columns.push(ColumnType.EditLink);
                continue;
            } else {
                columns.push(ColumnType.Text);
            }
        }

        return columns;
    };

    /**
     *  簡単追加機能を追加
     * @param {HTMLTableElement} tableNode
     * @param {ColumnType[]} columnTypes
     */
    const setupAddHeader = (tableNode, columnTypes) => {
        const editLink = tableNode.tHead
            ?.querySelector(".table_edit_link a")
            ?.getAttribute("href");
        if (!editLink) {
            return;
        }

        const node = createNanjGridInputElement(columnTypes);
        node.addEventListener("click", (event) => {
            if (!(event.target instanceof HTMLElement)) return;

            if (event.target.classList.contains(columnPostButtonClass)) {
                /** @type {string[]} */
                const columnValues = [];
                for (const columnNode of node.querySelectorAll("td")) {
                    const inputNode = columnNode.querySelector("textarea");
                    if (inputNode === null) {
                        continue;
                    }

                    const columnType = columnTypes[columnNode.cellIndex];
                    let value =
                        columnType === ColumnType.Prompt
                            ? encodeColumnValue(inputNode.value)
                            : inputNode.value;
                    value = value.trim();
                    value = value.replace(/\n/g, ""); //改行はすべて消す
                    columnValues.push(value);
                }
                postColumnDataAsync(editLink, columnValues);
            }
        });
        tableNode.tHead?.append(node);
    };

    /**
     * コピーボタンを付けて、プロンプトをスクロールできるようにする
     * @param {HTMLTableElement} tableNode
     * @param {ColumnType[]} columnTypes
     */
    const setupPromptCellNode = (tableNode, columnTypes) => {
        for (const rowNode of tableNode.tBodies[0].rows) {
            for (const cellNode of rowNode.cells) {
                if (columnTypes.length <= cellNode.cellIndex) {
                    continue;
                }
                if (columnTypes[cellNode.cellIndex] !== ColumnType.Prompt) {
                    continue;
                }

                const divNode = document.createElement("div");
                divNode.classList.add(promptTableCellClass);

                const copyButtonNode = document.createElement("button");
                copyButtonNode.textContent = "Copy";

                const promptTextAreaNode = document.createElement("textarea");
                promptTextAreaNode.disabled = true;
                promptTextAreaNode.value = cellNode.innerText;

                divNode.append(copyButtonNode);
                divNode.append(promptTextAreaNode);
                cellNode.innerText = "";
                cellNode.append(divNode);

                copyButtonNode.addEventListener("click", () => {
                    navigator.clipboard.writeText(promptTextAreaNode.value);
                });
            }
        }
    };

    const setupTable = () => {
        const tableNodes = /** @type {HTMLCollectionOf<HTMLTableElement>} */ (
            document.body.getElementsByClassName(targetTableClass)
        );
        for (const tableNode of tableNodes) {
            if (tableNode.tHead === null) {
                continue;
            }

            const columnTypes = getColumnTypes(tableNode.tHead);
            if (columnTypes === undefined) {
                continue;
            }
            setupAddHeader(tableNode, columnTypes);
            //setupPromptCellNode(tableNode, columnTypes);
        }
    };

    const onMyLoadEvent = () => {
        setupTable();
    };

    document.addEventListener("DOMContentLoaded", onMyLoadEvent);
}