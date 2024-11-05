<script lang="ts">
	import { marked } from 'marked';
  
	export let content = '';
	
</script>
  
<div class="markdown">{@html marked(content)}</div>
  
<style>
	.markdown h1 {
	  font-size: 2em;
	}
	.markdown p {
	  line-height: 1.5;
	}
</style>
  