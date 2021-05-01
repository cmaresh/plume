//when document is ready
//  PLUME = find element with [plume]
//  
//  if no elements have [plume], return
//
//  generate menu elements (including listeners)
//  check if <plume-menu /> exists
//  if it does:
//      add menu elements as child of <plume-menu />
//  else:
//      add menu elements as child of <body>
//
//

function defaultAdd(plume) {
    const item = plume.list.addItem();
    item.elem.querySelector('input').focus();
}

function defaultShiftUp(plume) {
    const list = plume.list;

    for (let i = 0; i < list.elem.children.length; i++) {
        if (list.elem.children[i].classList.contains('plume-selected')) {
            if (i == 0) continue;
            if (list.elem.children[i-1].classList.contains('plume-selected')) continue;
            let elem = list.elem.children[i]
            let siblingElem = list.elem.children[i-1];
            list.elem.removeChild(elem);
            list.elem.insertBefore(elem, siblingElem);
        }
    }
}

function defaultShiftDown(plume) {
    const list = plume.list;

    for (let i = list.elem.children.length - 1; i >= 0; i--) {
        if (list.elem.children[i].classList.contains('plume-selected')) {
            if (i == list.elem.children.length - 1) continue;
            if (list.elem.children[i+1].classList.contains('plume-selected')) continue;
            let elem = list.elem.children[i]
            let siblingElem;
            if (i <= list.elem.children.length - 2) {
                siblingElem = list.elem.children[i+2];
            }
            list.elem.removeChild(elem);
            if (siblingElem) {
                list.elem.insertBefore(elem, siblingElem);
            } else {
                list.elem.appendChild(elem);
            }
        }
    }
}

function defaultEdit(plume) {
    const selection = plume.list.items.filter(item => item.elem.classList.contains('plume-selected'));
    selection.forEach(item => {
        item.changeState('default');
        item.elem.classList.add('plume-editing');
    });
    plume.menu.toggleSubmenu('editing');
    selection[0].elem.querySelector('input').focus();
}

function defaultSave(plume) {
    const selection = plume.list.items.filter(item => item.elem.classList.contains('plume-editing'));
    selection.forEach(item => {
        item.changeState('display');
        item.elem.classList.remove('plume-editing');
    });
    plume.menu.toggleSubmenu('selection');

}

function defaultRemove(plume) {
    const selection = plume.list.items.filter(item => item.elem.classList.contains('plume-selected'));
    selection.forEach(item => {
        plume.list.removeItem(item);
    });
}

function getPlumeRoot() {
    const li = document.createElement('li');
    li.setAttribute('plume-item-content', '');
    li.classList.add('plume-item');
    return li;
}

function getPlumeDefault() {
    const input = document.createElement("input");
    input.setAttribute('plume-bind', 'content');
    return input;
}

function getPlumeDisplay() {
    const span = document.createElement("span");
    span.setAttribute('plume-bind', 'content');
    return span;
}

class Hooks {
    //plume_focus
    //plume_blur
    //plume_item_clicked
    //plume_item_added
    //plume_item_shifted
    //plume_item_removed
    //plume_item_state_change
    hooks;
    constructor() {
        this.hooks = {};
        this.hooks['plume_blur'] = [];
        this.hooks['plume_item_clicked'] = [];
        this.hooks['plume_item_added'] = [];
        this.hooks['plume_item_removed'] = [];
    }

    add(hook, func) {
        this.hooks[hook].push(func);
    }

    run(hook, args) {
        this.hooks[hook].forEach(func => func(args));
    }
}

const PLUME_HOOKS = new Hooks();

class Item {
    elem;
    props = {}
    nodes = {};
    index;
    active;

    constructor(templates, index, props) {
        if (!templates.root) {
            throw new Error("Plume - Root template is required for all items.")
        }

        this.index = index;
        this.props = props;
        this.elem = templates.root.cloneNode(true);
        for(let template in templates) {
            if (template == 'root') continue;
            this.nodes[template] = templates[template].cloneNode(true);
        }

        if (this.nodes['default']) this.changeState("default");

        this.elem.addEventListener('input', e => {
            this.save();
        })
    }

    load() {
        const nodeElem = this.elem;
        const varElems = nodeElem.querySelectorAll('[plume-bind]');
        for (let i = 0; i < varElems.length; i++) {
            let elem = varElems[i];
            let prop = elem.getAttribute('plume-bind');
            if (!this.props[prop]) continue;
            if (elem.tagName == 'INPUT') {
                elem.value = this.props[prop];
            } else {
                elem.textContent = this.props[prop];
            }
        }
    }

    save() {
        const nodeElem = this.elem;
        const varElems = nodeElem.querySelectorAll('[plume-bind]');
        for (let i = 0; i < varElems.length; i++) {
            let elem = varElems[i];
            let prop = elem.getAttribute('plume-bind');
            if (elem.tagName == 'INPUT') {
                this.props[prop] = elem.value;
            } else {
                this.props[prop] = elem.textContent;
            }
        }
    }

    changeState(node) {
        const nodeElem = this.nodes[node];
        if (this.elem.hasAttribute('plume-item-content')) {
            this.elem.innerHTML = nodeElem.outerHTML;
        } else {
            this.elem.querySelector('[plume-item-content]').innerHTML = nodeElem.outerHTML;
        }
        this.active = nodeElem;
        this.load();
    }

    updateTemplate(id, template) {
        let update = false;
        if (this.templates[id] == this.active) {
            update = true;
        }
        this.templates[i] = template.cloneNode(true);
        if (update) this.changeState(id);
    }
}

class List {
    /*
    create templates object
    each template must have a name and a DOM element
    user can define new templates
    two required templates are 'root' and 'basic'
    root template must have an element with attribute 'plume-item-content'
    'basic' template is autogenerated with addItem()
    offer 'swap' function to change out templates as child of plume-item-content element
    bind data between templates with 'plume-bind="var"'
    */
    templates = {
        root: getPlumeRoot(),
        default: getPlumeDefault(),
        display: getPlumeDisplay(),
    }
    selection = [];

    constructor(list) {
        this.index = 0;
        this.elem = list;
        this.items = [];

        for (let i = 0; i < list.children.length; i++) {
            list.children[i].setAttribute('plume-index', this.index++);
            this.items.push(list.children[i]);
        }
    }

    addItem(props = {}) {
        const item = new Item(this.templates, this.index++, props);
        this.items.push(item);
        this.elem.appendChild(item.elem);
        PLUME_HOOKS.run('plume_item_added', item);
        return item;
    }

    removeItem(item) {
        this.items = this.items.filter(_item => _item != item);
        this.elem.removeChild(item.elem);
        PLUME_HOOKS.run('plume_item_removed', item);
    }

    getItemFromDOMElement(elem) {
        return this.items.find(item => item.elem == elem);
    }

    updateTemplate(id, template) {
        this.templates[id] = template;
        this.items.forEach(item => {
            item.updateTemplate(id, template);
        })
    }
}

class Menu {
    constructor(menu) {
        this.elem = menu;
        this.options = [];
    }

    addOption(id, submenu = [], action = null, innerHTML = '') {
        if (this.options.find(option => option.id == id)) throw new Error("Option " + id + " already exists");
        const button = document.createElement("button");
        button.id = "plume-" + id;
        button.classList.add('plume-option');
        this.elem.appendChild(button);

        const newOption = {id, submenu, action, button};
        newOption.button.innerHTML = innerHTML;

        if (id == 'add') {
            newOption.active = ['default', 'selection', 'editing'];
            newOption.action = defaultAdd;
            newOption.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>';
        }

        if (id == 'shiftup') {
            newOption.active = ['selection', 'editing'];
            newOption.action = defaultShiftUp;
            newOption.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-up-circle" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8zm15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-7.5 3.5a.5.5 0 0 1-1 0V5.707L5.354 7.854a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 5.707V11.5z"/></svg>';
        }

        if (id == 'shiftdown') {
            newOption.active = ['selection', 'editing'];
            newOption.action = defaultShiftDown;
            newOption.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-down-circle" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8zm15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.5 4.5a.5.5 0 0 0-1 0v5.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V4.5z"/></svg>';
        }

        if (id == 'edit') {
            newOption.active = ['selection'];
            newOption.hide = ['editing'];
            newOption.action = defaultEdit;
            newOption.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pen" viewBox="0 0 16 16"><path d="M13.498.795l.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001zm-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708l-1.585-1.585z"/></svg>'
        }

        if (id == 'save') {
            newOption.active = ['editing'];
            newOption.hide = ['default', 'selection'];
            newOption.action = defaultSave;
            newOption.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-save" viewBox="0 0 16 16"><path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/></svg>';
        }

        if (id == 'remove') {
            newOption.active = ['selection', 'editing'];
            newOption.action = defaultRemove;
            newOption.button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>';
        }

        this.options.push(newOption);
        return newOption;
    }

    getOption(id) {
        const option = this.options.find(option => option.id == id);
        if (!option) throw new Error("Option " + id + " does not exist.");
        return option;
    }

    setAction(id, action) {
        this.getOption(id).action = action;
    }

    setHTML(id, HTML) {
        this.getOption(id).button.innerHTML = HTML;
    }

    setSubmenu(id, submenu) {
        this.getOption(id).active = submenu;
    }

    toggleSubmenu(submenu) {
        this.options.forEach(option => {
            const active = option.active && option.active.includes(submenu);
            const disabled = !active;
            const hidden = option.hide && option.hide.includes(submenu);
            if (active || disabled) {
                option.button.style.display = 'flex';
            }
            if (active) {
                option.button.classList.remove('plume-disabled');
            }
            if (disabled || hidden) {
                if (!option.button.classList.contains('plume-disabled')) {
                    option.button.classList.add('plume-disabled');
                }
            }
            if (hidden) {
                option.button.style.display = 'none';
            }
        })
    }
}

class Plume {
    constructor(list, menu) {
        this.list = list;
        this.menu = menu;
        this.hooks = new Hooks();

        document.addEventListener('click', e => {
            let elem = e.target;
            while (elem.parentNode) {
                if (elem == this.list) return;
                if (elem == this.menu) return;
                elem = elem.parentNode;
            }
            PLUME_HOOKS.run('plume_blur');
        });

        this.list.elem.addEventListener('click', e => {
            let elem = e.target;

            while (!elem.classList.contains('plume-item')) {
                if (elem.hasAttribute('plume')) return;
                elem = elem.parentNode;
            }

            if (e.target.tagName == 'INPUT' && elem.classList.contains('plume-selected')) return;
            PLUME_HOOKS.run('plume_item_clicked', this.list.getItemFromDOMElement(elem));
        });

        this.menu.elem.addEventListener('click', e => {
            let elem = e.target;

            while (!elem.classList.contains('plume-option')) {
                elem = elem.parentNode;
                if (elem == menu) return;
            }

            const id = elem.id.replace('plume-', '');
            this.runAction(id);
        });
    }

    runAction(id) {
        this.menu.getOption(id).action(this);
    }
    
    option(id, 
        submenu = ['default'], 
        action = () => console.log(id + ' clicked.'), 
        innerHTML = id) {
        return this.menu.addOption(id, submenu, action, innerHTML);
    }

    item(props = {}) {
        return this.list.addItem(props);
    }

    hook(hook, action) {
        PLUME_HOOKS.add(hook, action);
    }

    template(id, template) {
        this.list.updateTemplate(id, template);
    }

    getItemsWithClass(className) {
        const results = [];
        this.list.items.forEach(item => {
            if (item.elem.classList.contains(className)) {
                results.push(item);
            }
        });
        return results;
    }
}

/**
 * Generate a set of list options for a given element on this page. (use period)
 *
 * Bind to an element with attribute 'plume'. User may add children to this element
 * and highlight elements to either reorder or delete them depending on the options
 * provided to this function. To perform these actions, a menu is injected either as
 * a directed child of <body> or in the location designated by an element with the
 * 'plume-menu' attribute set. 
 *
 * @param {Object} [params={actions: ['add', 'shift', 'changepos', 'remove']}]     Params for this function.
 * @param {string[]}   [params.actions] Designate what actions should be available for
 * the user in the injected menu. Possible actions are 'add', 'shift',
 * 'changepos' and 'delete'.
 */
function init(params=['add', 'shiftup', 'shiftdown', 'edit', 'save', 'remove']) {
    // let creatingItem = false;
    // let editing = false;
    // let editingElem;

        let listElem = document.querySelector('[plume]');
        let menuElem = document.querySelector('[plume-menu]');

        if (!listElem) {
            console.warn('Unable to find <plume> element on this page. Exiting.');
            return;
        }

        if (!menuElem) {
            menuElem = document.createElement('div');
            menuElem.setAttribute('plume-menu', '');
            document.querySelector('body').appendChild(menuElem);
        }

        const list = new List(listElem);
        const menu = new Menu(menuElem);

        params.forEach(param => menu.addOption(param));

        menu.toggleSubmenu('default');
        
        const plume = new Plume(list, menu);

        PLUME_HOOKS.add('plume_item_clicked', (item) => {
            const list = plume.list;
            list.items.forEach(_item => {
                if (item != _item) {
                    _item.elem.classList.remove('plume-selected');
                    _item.elem.classList.remove('plume-editing');
                }
            });
        });

        PLUME_HOOKS.add('plume_item_clicked', (item) => {
            const list = plume.list;
            list.items.forEach(_item => {
                if (item != _item) {
                    _item.changeState('display');
                }
            });
        });

        PLUME_HOOKS.add('plume_item_clicked', (item) => {
            if (item.elem.classList.contains('plume-editing')) {
                return;
            }

            if (item.elem.classList.contains('plume-selected')) {
                item.elem.classList.remove('plume-selected');
                item.elem.classList.remove('plume-editing');
                item.changeState('display');
            } else {
                item.elem.classList.add('plume-selected');
            }
        });

        
        PLUME_HOOKS.add('plume_item_clicked', (item) => {
            const editing = list.items.filter(_item => _item.elem.classList.contains('plume-editing'));
            const selected = list.items.filter(_item => _item.elem.classList.contains('plume-selected'));
            if (editing.length > 0) {
                plume.menu.toggleSubmenu('editing');
            }
            else if (selected.length > 0) {
                plume.menu.toggleSubmenu('selection');
            } else {
                plume.menu.toggleSubmenu('default')
            }
        });

        PLUME_HOOKS.add('plume_item_added', (item) => {
            const list = plume.list;
            list.items.forEach(_item => {
                if (item != _item) {
                    _item.elem.classList.remove('plume-selected');
                    _item.elem.classList.remove('plume-editing');
                    _item.changeState('display');
                }
            });
            item.elem.classList.add('plume-selected');
            item.elem.classList.add('plume-editing');
            plume.menu.toggleSubmenu('editing');
        })
        
        return plume;
}

let plume;
document.addEventListener('DOMContentLoaded', () => plume = init());
