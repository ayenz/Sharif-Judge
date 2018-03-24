<?php
/**
 * SharIF Judge online judge
 * @file Hof.php
 * @author Stillmen Vallian <stillmen.v@gmail.com>
 */
defined('BASEPATH') OR exit('No direct script access allowed');

class Hof extends CI_Controller
{


	public function __construct()
	{
		parent::__construct();
		if ( ! $this->session->userdata('logged_in')) // if not logged in
			redirect('login');
	}




	// ------------------------------------------------------------------------




	public function index()
	{
		$this->twig->display('pages/hof.twig');
	}




	// ------------------------------------------------------------------------

}
