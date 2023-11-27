{
 

description = ''A flake that creates a devShell containing the following:
			- Nixvim (nixos-23.05 stable)
			- NodeJS
		'';

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-23.05";
    flake-utils.url = "github:numtide/flake-utils";
    nixvim.url = "github:nix-community/nixvim/nixos-23.05";
  };

  outputs = { self, nixpkgs, flake-utils, nixvim }:

    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      

	# Configure Neovim
	nvim = nixvim.legacyPackages.${system}.makeNixvim {
	
	globals.mapleader = " ";

        # Undo directory and set undodir to true(long-lasting undo tree)
        extraConfigLua = ''
		vim.opt.undodir = os.getenv("HOME") .. "/.vim/undodir";
		vim.opt.undofile = true;
        '';

	# Neovim basic options
	options = {

		# Show line numbers
		number = true;
		relativenumber = true;
		scrolloff = 8;

		# Tabs
		shiftwidth = 4;
		tabstop = 4;
		softtabstop = 4;
		expandtab = true;



		incsearch = true;

		colorcolumn = "80";

	};

	maps = {
		# EXAMPLE
		# Equivalent to nnoremap ; :
		# normalVisualOp.";" = ":";
		# Equivalent to nmap <silent> <buffer> <leader>gg <cmd>Man<CR>
		/*
		normal."<leader>gg" = live_grelive_grep
		silent = true;
		remap = false;
		action = "<cmd>Man<CR>";
		};
		*/
		# Etc...

		# My keymap


        # jump half a page and stay in the middle of the screen
        normal."<C-d>" = {
            action = "<C-d>zz";
        };

        normal."<C-u>" = {
            action = "<C-u>zz";
        };

        normal."n" = {
            action = "nzzzv";
        };

        normal."N" = {
            action = "Nzzzv";
        };

        normal."<leader>y" = {
            action = "\"+y";
        };

        visual."<leader>y" = {
            action = "\"+y";
        };

        normal."<leader>d" = {
            action = "\"_d";
        };

        visual."<leader>d" = {
            action = "\"_d";
        };
        
        normal."Q" = {
            action = "<nop>";
        };

        visual."J" = {
            action = ":m '>+1<CR>gv=gv";
        };

		visual."K" = {
			action = ":m '<-2<CR>gv=gv";
		};

        visualOnly."<leader>p" = {
            action = "\"_dP";
        };

        normal."<leader>f" = {
            action = "function() vim.lsp.buf.format() end)";
        };

        normal."<leader>k" = {
            action = "<cmd>lnext<CR>zz";
        };

        
        normal."<leader>j" = { 
            action = "<cmd>lprev<CR>zz";
        };

        # diagnostic go to next
        normal."<C-k>" = {
            action = "<cmd>cnext<CR>zz";
        };

        # diagnostic go to prev
        normal."<C-j>" = { 
            action = "<cmd>cprev<CR>zz";
        };

        normal."<leader>s" = {
            action = ":%s/\\<<C-r><C-w>\\>/<C-r><C-w>/gI<Left><Left><Left>";
        };

		# Undotree
		normal."<leader>u" = {
			silent = true;
			remap = false;
			action = "<cmd>UndotreeToggle<CR>";
		};

		# Fugitive
		normal."<leader>gs" = {
			silent = true;
			remap = false;
			action = "<cmd>Git<CR>";
		};

		normal."<leader>t" = {
			silent = true;
			remap = false;
			action = "<cmd>NvimTreeToggle<CR>";
		};
	};

# ---------------------------------------------------------------------------- #


	# Color scheme
	colorschemes.onedark.enable = true;

	plugins.lightline.enable = true;
		
	# File Tree plugin
	plugins.nvim-tree = {
		enable = true;
		disableNetrw = true;
		openOnSetup = true;
		tab.sync.open = true;
	};

	# Code highlighting and indentation(All grammars enabled by default)
	plugins.treesitter = {
		enable = true;
		indent = true;
		folding = false;
	};


	# Enables fuzzy finding through treesitter, LSP...
	plugins.telescope = {
		enable = true;

		keymaps = {
		#	"<leader>fg" = "live_grep"; <--- this requires ripgrep(not available as a module in nixvim for now)
			"<leader>ff" = "find_files";
			"<leader>fb" = "buffers";
			"<leader>fg" = "live_grep";
			"<C-p>" = "git_files";

			/*
			This doesnt work because perhaps it should be in some extraConfigLua variable	
			Grep text with telescope in current file
			normal."<leader>ps" = {
				action = "function() builtin.grep_string({ search = vim.fn.input(\"Grep > \")}); end";
			};
			*/	
		};
	};

	# Telescope extension
	plugins.harpoon = {
		enable = true;

		keymaps = {

			addFile = "<leader>a";
			toggleQuickMenu = "<C-e>";
			navFile = {
				"1" = "<C-h>";
				"2" = "<C-t>";
			};
		};
	};


	# Git integration
	plugins.fugitive.enable = true;

	# Track change history
	plugins.undotree.enable = true;


	plugins.inc-rename = {
		enable = true;
		cmdName = "IncRename";
		hlGroup = "Substitute";
		previewEmptyName = false;
		showMessage = true;
		inputBufferType = null;
		postHook = null;
	};
	
	# Auto comments
	plugins.comment-nvim = {
		enable = true;

		toggler.line = "gcc";
		toggler.block = "gbc";
	};

	# Language Server Protocol
	plugins.lsp = {
		enable = true;

		keymaps = {
			silent = true;
			diagnostic = {
			#	"<leader>k" = "goto_prev"; <--- defined above
			#	"<leader>j" = "goto_next"; <--- defined above
			};

			lspBuf = {
				"gd" = "definition";
				"gD" = "references";
				"gt" = "type_definition";
				"gi" = "implementation";
				"K" = "hover";
			};
			
		};

		servers = {
			astro.enable = true;
			bashls.enable = true;
			clangd.enable = true;
			clojure-lsp.enable = true;
			cssls.enable = true;
			dartls.enable = true;
			denols.enable = true;
			eslint.enable = true;
			elixirls.enable = true;
			futhark-lsp.enable = true;
			gopls.enable = true;
			hls.enable = true;
			html.enable = true;
			jsonls.enable = true;
			lua-ls.enable = true;
			metals.enable = true;
			nil_ls.enable = true;
			pylsp.enable = true;
			pyright.enable = true;
			rnix-lsp.enable = true;
			ruff-lsp.enable = true;
			rust-analyzer.enable = true;
			sourcekit.enable = true;
			tailwindcss.enable = true;
			terraformls.enable = true;
			texlab.enable = true;
			tsserver.enable = true;
			typst-lsp.enable = true;
			vuels.enable = true;
			yamlls.enable = true;
			zls.enable = true;
		};
		
	}; 

	#Rust tools to make use of LSP for rust
	plugins.rust-tools.enable = true;

	# Auto-completion
	plugins.luasnip = {
		enable = true;
# not sure how to setup this snippet lib ---> "rafamadriz/friendly-snippets"
	};

	plugins.nvim-cmp = {
		enable = true;

		snippet.expand = "luasnip";
		completion = {
			keywordLength = 1;
		};
		# Can define more sources later. see nixvim cmp helper for full list
		sources = 
          [
            { name = "nvim_lsp"; }
            { name = "luasnip"; } #For luasnip users.
            { name = "path"; }
            { name = "buffer"; }
          ]
        ;
        
		# Mappings for autocompletion
		mapping = {
		    "<CR>" = "cmp.mapping.confirm({ select = true })";
		    "<C-p>" = "cmp.mapping.select_prev_item(cmp_select)";
		    "<C-n>" = "cmp.mapping.select_next_item(cmp_select)";
		    "<C-Space>" = "cmp.mapping.complete()";
		};

	};

	/*
	plugins.coq-nvim = {
		enable = true;
		autoStart = true;
	};
	*/

	# Debugging
	#plugins.dap.enable = true;


	# TODO: 
	# Utils: (auto) refactor and indentations
	# Debugging tools like vimspector and codelldb and nvim-DAP
	# FOR DAP: MUST SET A DIFFERENT BRANCH OF nixpkgs AND CONSISTENTLY SET FOR NIXVIM TOO!!!
	# Snippets(rafamadriz/friendly-snippets) - LATER
	};

	in {
	  devShell = pkgs.mkShell { buildInputs = [ nvim pkgs.ripgrep pkgs.nodejs_20]; };
	});    

}
